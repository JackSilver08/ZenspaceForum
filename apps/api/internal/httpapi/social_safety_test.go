package httpapi

import "testing"

func TestValidReportReason(t *testing.T){
    for _,key:=range []string{"spam","harassment","hate","violence","sexual","misinformation","other"}{
        if !validReportReason(key){t.Errorf("expected reason %q accepted",key)}
    }
    for _,key:=range []string{"","SPAM","fraud'; DROP TABLE BaiDang;--","unknown"}{
        if validReportReason(key){t.Errorf("unexpected reason %q accepted",key)}
    }
}
