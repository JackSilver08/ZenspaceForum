package httpapi

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"

    "github.com/gin-gonic/gin"
)

func TestParsePositiveID(t *testing.T) {
    tests:=[]struct{label string;value interface{};want int;valid bool}{
        {"JSON integer",float64(15),15,true},
        {"string", "15",15,true},
        {"trimmed string"," 15 ",15,true},
        {"int",int(15),15,true},
        {"fraction",float64(15.5),0,false},
        {"decimal string","15.5",0,false},
        {"zero",float64(0),0,false},
        {"negative",float64(-2),0,false},
        {"text","wat",0,false},
        {"nil",nil,0,false},
        {"boolean",true,0,false},
        {"unsafe JSON integer",float64(9007199254740992),0,false},
        {"json.Number integer",json.Number("25"),25,true},
        {"json.Number fraction",json.Number("2.5"),0,false},
    }
    for _,tc:=range tests {
        t.Run(tc.label,func(t *testing.T){
            got,ok:=parsePositiveID(tc.value)
            if got!=tc.want || ok!=tc.valid {t.Fatalf("got (%d,%v) want (%d,%v)",got,ok,tc.want,tc.valid)}
        })
    }
}
func TestCORSAllowlist(t *testing.T) {
    gin.SetMode(gin.TestMode)
    r:=gin.New()
    r.Use(corsMiddleware([]string{"http://localhost:5173"}))
    r.POST("/api/example",func(c *gin.Context){c.Status(http.StatusOK)})

    tests:=[]struct{label,method,origin string;code int;allow bool}{
        {"allowed preflight","OPTIONS","http://localhost:5173",204,true},
        {"disallowed preflight","OPTIONS","https://evil.example",403,false},
        {"no origin","POST","",200,false},
        {"allowed POST","POST","http://localhost:5173",200,true},
        {"disallowed POST","POST","https://evil.example",200,false},
    }
    for _,tc:=range tests {
        t.Run(tc.label,func(t *testing.T){
            req:=httptest.NewRequest(tc.method,"/api/example",strings.NewReader("{}"))
            if tc.origin!=""{req.Header.Set("Origin",tc.origin)}
            if tc.method=="OPTIONS"{
                req.Header.Set("Access-Control-Request-Method","POST")
                req.Header.Set("Access-Control-Request-Headers","Authorization, Content-Type")
            }
            rec:=httptest.NewRecorder()
            r.ServeHTTP(rec,req)
            if rec.Code!=tc.code {t.Fatalf("HTTP %d want %d",rec.Code,tc.code)}
            val:=rec.Header().Get("Access-Control-Allow-Origin")
            if tc.allow && val!=tc.origin {t.Fatalf("allowed origin %q, wanted %q",val,tc.origin)}
            if !tc.allow && val!="" {t.Fatalf("unexpected access for origin %q",val)}
            if tc.allow && tc.method=="OPTIONS" && !strings.Contains(rec.Header().Get("Access-Control-Allow-Headers"),"Authorization"){
                t.Fatalf("preflight does not accept Authorization")
            }
        })
    }
}
func TestReactionCountInitialization(t *testing.T) {
    counts:=emptyReactionCounts()
    if len(counts)!=7 {t.Fatalf("expected seven reactions, got %d",len(counts))}
    for _,key:=range reactionTypes {
        if counts[key]!=0 {t.Fatalf("%s should start at 0",key)}
    }
}
