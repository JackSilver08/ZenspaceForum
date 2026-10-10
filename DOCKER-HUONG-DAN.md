# ZenSpace: chay bang Docker tren Windows

## Cai dat mot lan
1. Cai Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Mo Docker Desktop va cho den khi Docker Engine san sang.
3. Clone hoac giai nen toan bo repository, giu nguyen file `ZenSpaceDB_latest.sql`.

## Khoi dong bang mot lenh
Mo PowerShell tai thu muc goc repository va chay:

```powershell
.\START.bat
```

Hoac nhay dup `START.bat` trong File Explorer. Khong chay script tu thu muc `docs` / `docs\BACKEND`.

Lan dau, script tu tao file `.env`, sinh mat khau MySQL va JWT secret rieng cho may local, tu chon cong host con trong neu cac cong uu tien dang bi chiem, luu cau hinh vao `.env`, build backend va khoi dong MySQL + Redis + Go + Nginx. Khi API va website san sang, script tu mo trinh duyet va theo doi log.

Cac cong uu tien:
- Website: `8089`
- API health endpoint: `8081`
- MySQL tu may Windows: `3307`

Neu mot cong dang bi dung boi ung dung khac, script thu cong tiep theo va in URL / cong thuc te o dau log. Cac cong da chon duoc luu trong `.env` de nhung lan chay sau dung cung dia chi.

## Dung va xem log
- `STOP.bat`: dung cac container, giu lai database va uploads.
- `START.bat`: khoi dong lai, build backend khi code thay doi, mo trinh duyet va theo doi log.
- `docker compose logs -f --tail=100`: theo doi log thu cong.
- `docker compose ps`: xem trang thai service.

Nhan Ctrl+C trong cua so theo doi log chi dung theo doi log; container van chay. Chay `STOP.bat` neu muon dung ung dung.

## Database va uploads
- Database dung Docker volume `zenspace_mysql_data`.
- Anh va tep tai len duoc luu trong `data/uploads`.
- SQL duoc import tu dong chi khi volume MySQL duoc tao lan dau. Compose khong nhap de len database da ton tai moi lan khoi dong.
- Khong chay `docker compose down -v` neu muon giu database.
- SQL mau dung tai khoan demo voi mat khau chung `ZenSpaceDemo123!` (chi danh cho local development). Khong dung tai khoan/mat khau demo cho moi truong that.

## Cap nhat va khac phuc su co
```powershell
git pull
.\START.bat
```

Neu ban dang co thay doi chua commit, hay kiem tra `git status` truoc khi pull.

Neu service chua san sang, launcher tu hien `docker compose ps` va log 150 dong gan nhat. Co the xem lai bang:
```powershell
docker compose logs --tail=150 db redis backend web
```

File `.env` va thu muc `data/` bi bo qua boi Git, khong push mat khau local len repository.
