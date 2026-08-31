# คู่มือการนำระบบบริหารสัญญาขึ้น Vercel (Vercel Deployment Guide)
## ฝ่ายสาธารณูปโภค ส่วนการโยธา สำนักช่าง เทศบาลนครระยอง 2569

ระบบนี้ได้รับการออกแบบตามสถาปัตยกรรม **Decoupled Serverless Architecture**:
- **Frontend (หน้าเว็บ):** ทำงานบน **Vercel.app** โหลดเร็วทั่วโลก ปลอดภัย รองรับ Custom Domain
- **Backend (ฐานข้อมูล & Cloud Storage):** ทำงานบน **Google Sheets + Google Apps Script + Google Drive** 

---

### 📂 ไฟล์ทั้งหมดที่เตรียมไว้สำหรับการขึ้น Vercel:
1. `index.html` — ไฟล์หน้าเว็บแดชบอร์ดหลัก (Promage Theme + API Bridge)
2. `Code.gs` — โค้ด Backend รองรับ Web App & REST API (doGet / doPost)
3. `vercel.json` — ไฟล์การตั้งค่า Routing สำหรับ Vercel
4. `package.json` — ไฟล์ Metadata ของโปรเจกต์
5. `.gitignore` — ไฟล์ยกเว้นไฟล์ที่ไม่จำเป็น

---

## 🚀 ขั้นตอนที่ 1: Deploy Backend บน Google Apps Script (ได้ URL API)

1. เปิด **Google Sheets** ของระบบบริหารสัญญา
2. ไปที่เมนู **ส่วนขยาย (Extensions)** -> **Apps Script**
3. คัดลอกโค้ดทั้งหมดในไฟล์ `Code.gs` ไปวางทับใน Apps Script แล้วกด **บันทึก (Save 💾)**
4. กดปุ่มสีน้ำเงิน **การทำให้ใช้งานได้ (Deploy)** -> **การทำให้ใช้งานได้ใหม่ (New deployment)**
5. เลือกประเภท: **เว็บแอป (Web app)**
   - **คำอธิบาย (Description):** `Rayong CMS API v1`
   - **เรียกใช้ในฐานะ (Execute as):** `ฉัน (Me - your.email@gmail.com)`
   - **ผู้มีสิทธิ์เข้าถึง (Who has access):** `ทุกคน (Anyone)` ⚠️ *(สำคัญมาก เพื่อให้ Vercel เรียก API ได้)*
6. กด **ทำให้ใช้งานได้ (Deploy)** และคัดลอก **URL เว็บแอป (Web app URL)** เช่น:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

---

## 🚀 ขั้นตอนที่ 2: นำเว็บขึ้น Vercel.app

ท่านสามารถเลือกทำได้ 2 วิธีตามความสะดวก:

### วิธีที่ 1: อัปโหลดผ่าน GitHub (แนะนำ - สะดวกและอัปเดตอัตโนมัติ)
1. นำไฟล์ในโฟลเดอร์นี้อัปโหลดขึ้น **GitHub Repository** ของท่าน (เช่น `rayong-cms`)
2. เข้าเว็บไซต์ [https://vercel.com](https://vercel.com) แล้วล็อกอินด้วยบัญชี GitHub
3. กดปุ่ม **"Add New..."** -> **"Project"**
4. เลือก Repository `rayong-cms` แล้วกด **Import**
5. ในหน้าตั้งค่าโปรเจกต์ (ไม่ต้องแก้ค่าใดๆ) กดปุ่ม **Deploy**
6. ภายใน 30 วินาที ระบบจะสร้าง Domain ให้ทันที เช่น:
   ```
   https://rayong-cms.vercel.app
   ```

---

### วิธีที่ 2: Deploy ตรงจากเครื่องผ่าน Vercel CLI (ง่ายที่สุด ไม่ต้องใช้ GitHub)
1. เปิด **PowerShell** หรือ **Terminal** ในโฟลเดอร์นี้
2. พิมพ์คำสั่ง:
   ```bash
   npx vercel
   ```
3. ทำตามขั้นตอนบนหน้าจอ:
   - `Set up and deploy? [Y/n]` -> กด **Y** แล้ว Enter
   - `Which scope? [เลือกบัญชี Vercel ของท่าน]` -> กด Enter
   - `Link to existing project? [y/N]` -> กด **N** แล้ว Enter
   - `What's your project's name?` -> พิมพ์ `rayong-cms` แล้ว Enter
   - `In which directory is your code located?` -> กด Enter
4. เมื่ออัปโหลดเสร็จ ให้ Deploy ขึ้น Production ด้วยคำสั่ง:
   ```bash
   npx vercel --prod
   ```
5. ท่านจะได้ URL สำหรับเปิดใช้งานจริงทันที!

---

## 🔗 ขั้นตอนที่ 3: ผูก Google Apps Script URL กับ Vercel

1. เปิดเว็บที่ได้จาก Vercel (เช่น `https://rayong-cms.vercel.app`)
2. เข้าสู่ระบบด้วยบัญชีแอดมิน:
   - **Username:** `admin`
   - **Password:** `admin`
3. ไปที่เมนู **"Menu settings"** บนแถบด้านซ้าย
4. เลือกแท็บ **"ฐานข้อมูล & แคช"**
5. นำ **Google Apps Script Web App URL** ที่ได้จากขั้นตอนที่ 1 มาวางในช่อง:
   `Google Apps Script Web App URL (สำหรับ Vercel)`
6. กดปุ่ม **"บันทึก & ทดสอบ"**
7. เมื่อขึ้นข้อความ **"เชื่อมต่อ Google Apps Script สำเร็จ!"** ระบบ Vercel ของท่านจะเชื่อมต่อกับ Google Sheets และ Google Drive ของเทศบาลนครระยองอย่างสมบูรณ์แบบ 100%!

---

### 💡 บัญชีผู้ใช้งานเริ่มต้น:
- 🛡️ **Admin (ผู้ดูแลระบบ):** Username: `admin` / Password: `admin`
- 👷 **User (นายช่างโยธา):** Username: `somchai` / Password: `1234`
