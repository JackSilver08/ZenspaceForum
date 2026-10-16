package httpapi

import (
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func TestChatAttachmentTypes(t *testing.T){
 tests:=[]struct{ext,kind string;valid bool}{
  {".png","image",true},{".jpg","image",true},{".gif","image",true},
  {".heic","image",true},{".webm","video",true},{".mp4","video",true},
  {".mp3","audio",true},{".pdf","file",true},{".zip","file",true},
  {".docx","file",true},{".txt","file",true},{".exe","",false},
  {".html","",false},{".svg","",false},{".js","",false},
 }
 for _,tc:=range tests{
  t.Run(tc.ext,func(t *testing.T){
   kind,_,ok:=chatKind(tc.ext)
   if ok!=tc.valid||kind!=tc.kind {t.Fatalf("got (%s,%v), want (%s,%v)",kind,ok,tc.kind,tc.valid)}
  })
 }
}
func TestChatFileNameSanitized(t *testing.T){
 got:=chatFileName("../../sensitive\x00file.txt")
 if strings.ContainsAny(got,"/\\\x00") {t.Errorf("unsafe chat filename %q",got)}
 if got=="" {t.Error("empty filename")}
}
func TestTextAttachmentGzipOptimization(t *testing.T){
 dir:=t.TempDir()
 source:=filepath.Join(dir,"long.txt")
 plain:=[]byte(strings.Repeat("ZenSpace preserves all file bytes!\n",700))
 if err:=os.WriteFile(source,plain,0600);err!=nil {t.Fatal(err)}
 path,meta,err:=chatOptimize(t.Context(),source,".txt",dir,"testzip",int64(len(plain)))
 if err!=nil {t.Fatal(err)}
 if meta.Encoding!="gzip"||meta.StoredBytes>=meta.OriginalBytes {
  t.Fatalf("expected gzip saving, got %#v",meta)
 }
 if _,err=os.Stat(path);err!=nil {t.Fatal(err)}
}
