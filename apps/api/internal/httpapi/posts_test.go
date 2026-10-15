package httpapi

import (
    "strings"
    "testing"
)

func TestValidPostContent(t *testing.T) {
    cases := []struct { name,text string; ok bool } {
        {"Vietnamese", "Hôm nay có một câu chuyện ✨",true},
        {"whitespace", "  \n\t ",false},
        {"one character", "x",true},
        {"ten thousand", strings.Repeat("a",10000),true},
        {"ten thousand one", strings.Repeat("a",10001),false},
        {"Unicode characters", strings.Repeat("🌠",10000),true},
        {"Unicode over limit", strings.Repeat("🌠",10001),false},
    }
    for _,tc:=range cases {
        t.Run(tc.name,func(t *testing.T){
            if got:=validPostContent(tc.text);got!=tc.ok {
                t.Fatalf("validPostContent(%q) = %v; want %v",tc.name,got,tc.ok)
            }
        })
    }
}
