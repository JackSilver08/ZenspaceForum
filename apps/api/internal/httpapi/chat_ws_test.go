package httpapi

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestChatSubprotocolAuthentication(t *testing.T) {
    cases:=[]struct{header,want string}{
        {"zenspace.chat.v1, auth.abc.def","abc.def"},
        {"auth.abc.def, zenspace.chat.v1","abc.def"},
        {"zenspace.chat.v1",""},
        {"auth.abc.def",""},
        {"zenspace.chat.v1, auth.one, auth.two",""},
        {"zenspace.chat.v1, auth.",""},
    }
    for _,tc:=range cases {
        got:=chatJWTFromProtocols(tc.header)
        if got!=tc.want {t.Errorf("protocols %q: got %q, want %q",tc.header,got,tc.want)}
    }
}

func TestWebSocketOriginProtection(t *testing.T) {
    cases:=[]struct{origin,host string;allowed bool}{
        {"http://localhost:8089","localhost:8089",true},
        {"https://chat.example.org","chat.example.org",true},
        {"https://malicious.example","chat.example.org",false},
        {"http://localhost:8089","localhost:8081",false},
        {"","localhost:8089",false},
        {"null","localhost:8089",false},
    }
    for _,tc:=range cases {
        req:=httptest.NewRequest(http.MethodGet,"http://"+tc.host+"/api/chat/ws",nil)
        if tc.origin!="" {req.Header.Set("Origin",tc.origin)}
        if got:=sameOriginWebSocket(req);got!=tc.allowed {
            t.Errorf("origin %q host %q: allowed=%v, want %v",tc.origin,tc.host,got,tc.allowed)
        }
    }
}
func TestChatHubRecipientIsolation(t *testing.T) {
    hub:=newChatHub()
    a:=&chatClient{user:1,outgoing:make(chan []byte,2)}
    b:=&chatClient{user:2,outgoing:make(chan []byte,2)}
    unrelated:=&chatClient{user:3,outgoing:make(chan []byte,2)}
    for _,client:=range []*chatClient{a,b,unrelated} {
        if !hub.register(client) {t.Fatal("unable to register")}
        defer hub.unregister(client)
    }
    hub.notify(2,1,77)
    select{
    case payload:=<-b.outgoing:
        var event chatEvent
        if err:=json.Unmarshal(payload,&event);err!=nil {t.Fatal(err)}
        if event.Type!="chat.message"||event.MessageID!=77||event.PeerID!=1 {
            t.Fatalf("invalid event: %+v",event)
        }
    default:t.Fatal("recipient received no notification")
    }
    if len(a.outgoing)!=0 || len(unrelated.outgoing)!=0 {t.Fatal("cross-user notification leaked")}
}
