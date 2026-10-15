package httpapi

import (
    "strings"
    "testing"
)

func TestValidCommentContent(t *testing.T) {
    cases:=[]struct{label,value string;valid bool}{
        {"text","Một bình luận hữu ích",true},
        {"empty","  \n\t ",false},
        {"single character","x",true},
        {"unicode limit",strings.Repeat("✨",10000),true},
        {"unicode over limit",strings.Repeat("✨",10001),false},
        {"ascii limit",strings.Repeat("a",10000),true},
        {"ascii too long",strings.Repeat("a",10001),false},
    }
    for _,tc:=range cases {
        t.Run(tc.label,func(t *testing.T){
            if got:=validCommentContent(tc.value);got!=tc.valid {
                t.Fatalf("validCommentContent(%s)=%v, want %v",tc.label,got,tc.valid)
            }
        })
    }
}
