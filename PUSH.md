# Cara push ke GitHub

Repo kosongnya sudah ada: https://github.com/haikalmol/ats-job-radar

Buka isi `ats-job-radar.tar.gz`, masuk ke foldernya lewat PowerShell, lalu:

    git init
    git add .
    git commit -m "ATS job radar: read postings from company ATS APIs, reject what you cannot apply for"
    git branch -M main
    git remote add origin https://github.com/haikalmol/ats-job-radar.git
    git push -u origin main

Kalau diminta login, pakai GitHub CLI (`gh auth login`) atau Personal Access Token.
Jangan tempel token itu ke chat mana pun.

## Sebelum push, cek dua hal

1.  `npm test` harus keluar **18 correct, 0 wrong**.
2.  Pastikan `profile.js` TIDAK ikut ter-commit. Sudah masuk `.gitignore`,
    tapi cek sekali: `git status` tidak boleh menyebut `profile.js`.
    Yang ikut cuma `profile.example.js` yang isinya angka contoh.

## Sesudah push

Di halaman repo, klik roda gigi di sebelah "About" dan tambahkan topics:
`job-search`, `ats`, `greenhouse`, `lever`, `ashby`, `automation`, `nodejs`.
Itu yang bikin repo muncul di pencarian.

Lalu pin repo ini di profilmu: buka github.com/haikalmol, klik
"Customize your pins", centang `ats-job-radar`.
