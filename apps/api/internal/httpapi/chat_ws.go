package httpapi

import (
    "encoding/json"
    "net/http"
    "net/url"
    "strings"
    "sync"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
    "github.com/gorilla/websocket"
)

const (
    chatProtocol = "zenspace.chat.v1"
    chatAuthPrefix = "auth."
    chatPingInterval = 25 * time.Second
    chatPongTimeout = 65 * time.Second
    chatWriteTimeout = 8 * time.Second
)

type chatHub struct {
    mu sync.Mutex
    peers map[int]map[*chatClient]struct{}
}
type chatClient struct {
    conn *websocket.Conn
    outgoing chan []byte
    user int
}
type chatEvent struct {
    Type string `json:"type"`
    MessageID int64 `json:"messageId"`
    PeerID int `json:"peerId"`
}

func newChatHub() *chatHub { return &chatHub{peers: make(map[int]map[*chatClient]struct{})} }

func (h *chatHub) register(c *chatClient) bool {
    h.mu.Lock()
    defer h.mu.Unlock()
    if h.peers[c.user] == nil { h.peers[c.user] = make(map[*chatClient]struct{}) }
    if len(h.peers[c.user]) >= 8 { return false }
    h.peers[c.user][c] = struct{}{}
    return true
}
func (h *chatHub) unregister(c *chatClient) {
    h.mu.Lock()
    defer h.mu.Unlock()
    clients := h.peers[c.user]
    if _, exists := clients[c]; exists {
        delete(clients,c)
        close(c.outgoing)
    }
    if len(clients)==0 { delete(h.peers,c.user) }
}
func (h *chatHub) notify(user, peer int, id int64) {
    body,_ := json.Marshal(chatEvent{Type:"chat.message",MessageID:id,PeerID:peer})
    h.mu.Lock()
    defer h.mu.Unlock()
    for c := range h.peers[user] {
        select {
        case c.outgoing <- body:
        default:
            // A stalled browser cannot delay DB writes or other subscribers.
            delete(h.peers[user],c)
            close(c.outgoing)
        }
    }
    if len(h.peers[user])==0 { delete(h.peers,user) }
}
func (a *App) broadcastChat(sender, recipient int, id int64) {
    if a.hub==nil {return}
    a.hub.notify(sender,recipient,id)
    a.hub.notify(recipient,sender,id)
}

// The browser cannot attach an Authorization header to a WebSocket handshake.
// JWT is transmitted as a second WebSocket subprotocol, not in URL, cookies,
// server access logs, or the negotiated (echoed) chat subprotocol.
func chatJWTFromProtocols(header string) string {
    var supportsChat bool
    var token string
    for _, protocol := range strings.Split(header,",") {
        protocol = strings.TrimSpace(protocol)
        if protocol==chatProtocol { supportsChat=true }
        if strings.HasPrefix(protocol,chatAuthPrefix) && len(protocol)>len(chatAuthPrefix) {
            if token!="" {return ""}
            token=strings.TrimPrefix(protocol,chatAuthPrefix)
        }
    }
    if !supportsChat{return ""}
    return token
}
func sameOriginWebSocket(r *http.Request) bool {
    origin := r.Header.Get("Origin")
    if origin=="" {return false}
    value,err := url.Parse(origin)
    return err==nil && value.Host!="" && strings.EqualFold(value.Host,r.Host) &&
        (value.Scheme=="https" || value.Scheme=="http") &&
        value.User==nil && value.Path=="" && value.RawQuery==""
}
func (a *App) chatWebSocket(c *gin.Context) {
    if !sameOriginWebSocket(c.Request) { c.AbortWithStatus(http.StatusForbidden);return }
    raw := chatJWTFromProtocols(c.GetHeader("Sec-WebSocket-Protocol"))
    if raw=="" { fail(c,401,"Thiếu phiên kết nối hợp lệ");return }
    token,err := jwt.Parse(raw,func(t *jwt.Token)(interface{},error){
        if t.Method!=jwt.SigningMethodHS256 {return nil,jwt.ErrTokenSignatureInvalid}
        return a.Secret,nil
    },jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
    if err!=nil || !token.Valid {fail(c,401,"Phiên đã hết hạn");return}
    claims,ok := token.Claims.(jwt.MapClaims)
    if !ok {fail(c,401,"Phiên không hợp lệ");return}
    idFloat,ok := claims["id"].(float64)
    if !ok || idFloat<1 || idFloat!=float64(int(idFloat)) {fail(c,401,"Tài khoản không hợp lệ");return}
    id:=int(idFloat)
    expires,err:=claims.GetExpirationTime()
    if err!=nil || expires==nil || time.Until(expires.Time)<=0 {fail(c,401,"Phiên đã hết hạn");return}
    var exists int
    if err:=a.DB.QueryRowContext(c.Request.Context(),"SELECT id FROM TaiKhoan WHERE id=?",id).Scan(&exists);err!=nil {
        fail(c,401,"Tài khoản không còn tồn tại");return
    }
    upgrader:=websocket.Upgrader{
        Subprotocols:[]string{chatProtocol},
        ReadBufferSize:1024,WriteBufferSize:1024,
        CheckOrigin:sameOriginWebSocket,
    }
    if a.hub==nil {fail(c,503,"Chat realtime chưa sẵn sàng");return}
    conn,err:=upgrader.Upgrade(c.Writer,c.Request,nil)
    if err!=nil{return}
    client:=&chatClient{conn:conn,user:id,outgoing:make(chan []byte,64)}
    if !a.hub.register(client) {
        _=conn.WriteControl(websocket.CloseMessage,
            websocket.FormatCloseMessage(websocket.ClosePolicyViolation,"Quá nhiều kết nối"),
            time.Now().Add(chatWriteTimeout))
        _=conn.Close()
        return
    }
    defer a.hub.unregister(client)
    defer conn.Close()
    done:=make(chan struct{})
    stop:=make(chan struct{})
    go func(){
        defer close(done)
        defer conn.Close()
        ticker:=time.NewTicker(chatPingInterval)
        defer ticker.Stop()
        for {
            select {
            case <-stop:
                return
            case message,ok:=<-client.outgoing:
                if !ok{return}
                _=conn.SetWriteDeadline(time.Now().Add(chatWriteTimeout))
                if err:=conn.WriteMessage(websocket.TextMessage,message);err!=nil{return}
            case <-ticker.C:
                if time.Now().After(expires.Time) {return}
                _=conn.SetWriteDeadline(time.Now().Add(chatWriteTimeout))
                if err:=conn.WriteMessage(websocket.PingMessage,nil);err!=nil{return}
            }
        }
    }()
    conn.SetReadLimit(1024)
    _=conn.SetReadDeadline(time.Now().Add(chatPongTimeout))
    conn.SetPongHandler(func(string)error {
        deadline:=time.Now().Add(chatPongTimeout)
        if deadline.After(expires.Time){deadline=expires.Time}
        return conn.SetReadDeadline(deadline)
    })
    for {
        if _,_,err:=conn.ReadMessage();err!=nil {break}
    }
    // Closing the connection also stops any blocked writer. Only the writer
    // sends frames, so concurrent write calls never race.
    close(stop)
    _=conn.Close()
    <-done
}
