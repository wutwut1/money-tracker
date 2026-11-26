# แผนงาน: บัญชีรายรับรายจ่ายส่วนตัว

โครงสร้าง / เทคโนโลยี: HTML/CSS/JS ล้วน ไม่มี build ใช้ `<script>` ธรรมดา (ห้ามใช้ ES modules) ไฟล์ logic ที่ไม่แตะ DOM ใช้ global ตัวเดียวคือ `window.MoneyCore` แต่ละไฟล์ห่อด้วย IIFE แล้วเติม namespace ย่อยของตัวเอง:
`window.MoneyCore = window.MoneyCore || {}; (function (MC) { MC.money = {...}; })(window.MoneyCore);`

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | markup ทุกหน้า: header + ตัวเลือกเดือน, การ์ดสรุป 3 ใบ, แท็บ รายการ/กราฟ/งบ/ตั้งค่า, ฟอร์มเพิ่ม/แก้, กล่องแจ้งเตือน `role="alert"`, ปุ่ม Export หาเจอง่าย รายชื่อ id อยู่ในคอมเมนต์หัวไฟล์ (สัญญา ห้ามเปลี่ยน) โหลด script ตามลำดับ money, data, reports, app, ui-charts, ui-budget, ui-settings |
| `css/style.css` | mobile-first ใช้ได้ที่ 360px ไม่มี scroll แนวนอน media query สำหรับคอม คลาส `.income` เขียว `.expense` แดง `.lv-green` `.lv-orange` `.lv-red` |
| `js/money.js` → `MoneyCore.money` | `parseAmount(str)` แปลงเป็นสตางค์หรือคืน error (trim แล้วตรวจ regex `^\d+(\.\d{1,2})?$` แยกเป็นสตริง ไม่คูณ float และไม่รับ 0), `formatBaht(satang)` เช่น `฿1,250.00` / `-฿120.00`, `todayISO(date?)` ใช้วันที่ local, `monthKey(date)`, `addMonths(key,n)`, `thaiMonthLabel(key)` ได้ "พฤศจิกายน 2569", `thaiMonthShort(key)` ได้ "พ.ย. 69" |
| `js/data.js` → `MoneyCore.data` | `createDefaultState()`, ฟังก์ชัน pure ที่คืน `{ok,state}` หรือ `{ok:false,error}`: `addTransaction`, `updateTransaction`, `deleteTransaction`, `addCategory`, `renameCategory`, `deleteCategory`, `setBudget`, `transactionsOfMonth(state,key)` (เรียงใหม่ไปเก่า ถ้าวันเดียวกันใช้ createdAt มากกว่าก่อน), `monthSummary(state,key)` คืน `{income,expense,balance}`, `serialize(state)`, `validateImport(text)` |
| `js/reports.js` → `MoneyCore.reports` | `pieSegments`, `pieSvg` (ถ้ามีหมวดเดียวใช้ `<circle>`), `barData` (6 เดือน), `barSvg`, `budgetStatus(state,key)` คืน `{categoryId,name,spent,budget,remaining,percent,level,over}` ต่อหมวด โดยเทียบด้วยจำนวนเต็ม, `isOverBudget(state,categoryId,key)`, `toCSV(state)`, `backupFileName(date)` |
| `js/app.js` → `window.App` | load/save localStorage, เดือนปัจจุบัน, การ์ดสรุป, รายการ, ฟอร์มเพิ่ม/แก้/ลบ, แท็บ, API `commit` `registerView` `onAfterSave` `download` `toast` `getState` `getMonth` เมื่อ init จบให้ตั้ง `body.dataset.ready="1"` |
| `js/ui-charts.js` | แท็บกราฟ |
| `js/ui-budget.js` | แท็บงบ และแจ้งเตือนเกินงบ |
| `js/ui-settings.js` | จัดการหมวด และ Export/Import |
| `tests/test.html`, `tests/harness.js` (`window.MoneyTest`), `tests/*.test.js` | unit test ที่รันใน Chrome headless |

Data model (ใช้รูปเดียวกันทั้งใน localStorage และไฟล์ export):
```json
{
  "version": 1,
  "categories": [{ "id": "exp-food", "type": "expense", "name": "อาหาร" }],
  "transactions": [{ "id": "t-…", "type": "expense", "amount": 12000, "categoryId": "exp-food",
                     "date": "2026-11-26", "note": "", "createdAt": 1795651200000 }],
  "budgets": { "exp-food": 100000 }
}
```
- amount และงบเก็บเป็นสตางค์ เป็นจำนวนเต็มบวก ไม่มีเครื่องหมาย รายรับหรือรายจ่ายดูจาก type
- ถ้างบว่างหรือ 0 ให้ลบ key ออก และเมื่อลบหมวด ให้ลบงบของหมวดนั้นด้วย
- `validateImport` ตรวจว่า version === 1, categories และ transactions เป็น array, budgets เป็น object, id ไม่ซ้ำ, type ถูกต้อง, ชื่อหมวดไม่ว่างและไม่ซ้ำในประเภทเดียวกัน, amount เป็นจำนวนเต็มบวกที่ไม่เกิน MAX_SAFE_INTEGER, date เป็นวันที่ที่มีจริง, categoryId มีอยู่และ type ตรงกัน, budgets ใช้กับหมวดรายจ่ายเท่านั้นและค่าเป็นจำนวนเต็มบวก

การตัดสินใจเพิ่มเติมของผู้คุมงาน (ใช้ค่าเริ่มต้นที่ปลอดภัย):
- CSV ป้องกันสูตร: ถ้าค่าข้อความขึ้นต้นด้วย `=` `+` `-` `@` ให้เติม `'` นำหน้า
- ข้อมูลใน localStorage เสีย: แสดง error และไม่เขียนทับ
- ทดสอบผ่าน static server: ใช้สคริปต์ PowerShell `System.Net.HttpListener` ชั่วคราวใน scratchpad

คำสั่งตรวจ (PowerShell; `$P` = scratchpad\chrome-profile):
1. Unit test: `& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --allow-file-access-from-files --user-data-dir="$P" --dump-dom "file:///C:/Users/User/Desktop/Game%20Test%20Claude/game%205/tests/test.html" | Out-String`
   ผ่านเมื่อ `<pre id="result">` จบด้วย `PASS n/n` และไม่มีบรรทัด `FAIL`
2. Smoke test: คำสั่งเดียวกันแต่เปลี่ยนเป็น `index.html` ผ่านเมื่อ body มี `data-ready="1"`, มี `฿0.00` อย่างน้อย 3 ที่, มีชื่อเดือนไทยกับปี พ.ศ. และมีข้อความ "เพิ่มรายการ"
(ยืนยันแล้ว 2026-11-26 ว่า `--dump-dom` พิมพ์ DOM ภาษาไทยออก stdout ได้)

## ขั้นตอน
ลำดับ: ขั้น 1→(2,3) ทำคู่กับขั้น 4 ได้ ขั้น 5 รอ 1, 2, 4 ส่วนขั้น 6, 7, 8 ทำพร้อมกันได้หลังขั้น 5 และขั้น 9 ทำสุดท้าย

- [x] 1. ระบบเทส + ไฟล์ตัวเลข/วันที่
      ไฟล์: `tests/harness.js`, `tests/test.html`, `js/money.js`, `tests/money.test.js`
      ทำ: harness (`test`, `eq`, `ok`, `deepEq` จับ exception ทีละเทส ถ้า script โหลดไม่ได้หรือชุดที่คาดไว้ไม่ลงทะเบียนนับเป็น FAIL พิมพ์ `FAIL <ชุด> > <ชื่อ>: <ข้อความ>` แล้วตามด้วยบรรทัดสรุป `PASS n/n` หรือ `FAIL x/n`) ใน test.html ใส่ script ทุกไฟล์และชุดที่คาดไว้ `['money','data','reports']` ไว้ตั้งแต่ขั้นนี้
      เกณฑ์ผ่าน: ชุด money ผ่านหมด และมีเทสเหล่านี้:
      - parseAmount ไม่รับ "", "0", "-5", "abc", "1.234" ส่วน "120" ได้ 12000 และ "0.1" ได้ 10
      - formatBaht(10+20) ได้ "฿0.30", 125000 ได้ "฿1,250.00", -12000 ได้ "-฿120.00", 1500000 ได้ "฿15,000.00"
      - addMonths('2026-01',-1) ได้ '2025-12' และ thaiMonthLabel('2026-11') ได้ "พฤศจิกายน 2569"
      - todayISO ใช้วันที่ local

- [x] 2. Data model, หมวด, รายการ, สรุป, import
      ไฟล์: `js/data.js`, `tests/data.test.js`
      ทำ: ทำตามตารางข้างบน ข้อความ error เป็นภาษาไทย และห้ามแก้ object เดิม
      เกณฑ์ผ่าน: ชุด data ผ่านหมด และครอบคลุม:
      - หมวดเริ่มต้นมีครบ 8+3
      - ชื่อว่างหรือซ้ำในประเภทเดียวกันถูกปฏิเสธ แต่ "อื่นๆ" ข้ามประเภทได้
      - เปลี่ยนชื่อแล้ว categoryId ไม่เปลี่ยน
      - ลบหมวดที่มีรายการไม่ได้ ลบหมวดว่างได้และงบหายด้วย
      - สรุปได้ {1500000,12000,1488000}
      - กรองตามเดือนและเรียงลำดับถูก
      - แก้ 12000 เป็น 15000 แล้วสรุปเปลี่ยนตาม
      - validateImport ไม่รับ "not json", {}, version ผิด, amount ที่เป็นทศนิยมหรือติดลบ, categoryId ที่ไม่มีอยู่ และ serialize แล้ว validateImport กลับมาได้ข้อมูลเท่าเดิม (deepEq)

- [x] 3. กราฟ งบ CSV ชื่อไฟล์
      ไฟล์: `js/reports.js`, `tests/reports.test.js`
      ทำ: ทำตามตารางข้างบน กรองข้อมูลจาก state.transactions เอง เปอร์เซ็นต์ปัดทศนิยม 1 ตำแหน่งและตัด ".0" ทิ้ง ใน CSV จำนวนเงินเขียนเป็น `120.00` ไม่มี ฿ ประเภทเขียนเป็น "รายรับ" หรือ "รายจ่าย" ขึ้นบรรทัดด้วย CRLF และกันสูตรตามข้อตัดสินใจข้างบน
      เกณฑ์ผ่าน: ชุด reports ผ่านหมด และครอบคลุม:
      - 30000 + 10000 ได้ 75/25 และมุมรวม 360
      - หมวดเดียวได้ full และ SVG มี `<circle`
      - เดือนว่างได้ []
      - barData ได้ 6 เดือนที่ลงท้ายด้วยเดือนที่เลือก และข้ามปีได้ ถ้าข้อมูลเป็น 0 ทั้งหมดต้องไม่มี NaN
      - งบ 100000: ใช้ 50000 ได้ green 50% เหลือ 50000, 85000 ได้ orange, 100000 ได้ orange, 120000 ได้ red และ over 20000
      - CSV ขึ้นต้นด้วย BOM และหัวคอลัมน์เป็น `วันที่,ประเภท,หมวด,จำนวนเงิน,โน้ต`
      - `a,b` ได้ `"a,b"`, `say "hi"` ได้ `"say ""hi"""` และค่าที่มีขึ้นบรรทัดใหม่ถูกครอบ
      - โน้ต `=1+1` ได้ `'=1+1`
      - backupFileName(new Date(2026,10,26)) ได้ `money-backup-2026-11-26.json`
      - หลังขั้น 2+3 ทั้ง test.html เป็น `PASS n/n`

- [x] 4. หน้าเว็บและ CSS
      ไฟล์: `index.html`, `css/style.css`
      ทำ: markup ครบ ข้อความเป็นภาษาไทยทั้งหมด มี viewport meta และ `lang="th"` ช่องเงินใช้ `type="text" inputmode="decimal"` ช่องวันที่ใช้ `type="date"` ไม่มี resource ภายนอก CSS ใช้ border-box ห้ามมี width ที่เป็น px เกิน 360 ใช้ flex wrap และ SVG ใช้ width:100% + viewBox รายชื่อ id อยู่ในคอมเมนต์หัวไฟล์
      เกณฑ์ผ่าน: dump-dom แล้วเจอทุก id ที่ประกาศไว้ (ส่วนการเช็คที่ 360px ทำด้วยมือในขั้น 9)

- [x] 5. แกนแอป
      ไฟล์: `js/app.js`
      ทำ:
      - load ผ่าน validateImport ถ้าไม่มี key ให้ใช้ค่าเริ่มต้น ถ้าข้อมูลเสียให้แสดง error และไม่เขียนทับ
      - commit ใช้ try/catch ถ้าบันทึกสำเร็จจึงเปลี่ยน state แล้ว render ทุก view ถ้าล้มเหลวให้ toast "บันทึกไม่สำเร็จ พื้นที่เก็บข้อมูลเต็ม"
      - เลือกเดือน การ์ดสรุป และรายการพร้อม +/- และสี
      - ฟอร์ม: วันที่เป็น todayISO, dropdown หมวดเปลี่ยนตามประเภท, error แสดงใต้ช่อง, ใช้ฟอร์มเดียวกันตอนแก้ไข
      - ลบต้องผ่าน confirm
      - เปิด API ตามตาราง, สลับแท็บได้ และตั้ง data-ready
      เกณฑ์ผ่าน: smoke test ผ่าน และ unit test ยังเป็น PASS

- [x] 6. แสดงกราฟ
      ไฟล์: `js/ui-charts.js`
      ทำ: registerView แล้ววาด pie, คำอธิบายสี (ชื่อ ยอด %) และ bar ถ้าไม่มีรายจ่ายให้แสดง "ยังไม่มีรายจ่าย"
      เกณฑ์ผ่าน: smoke test ผ่าน และ DOM มี "ยังไม่มีรายจ่าย"

- [x] 7. หน้างบและแจ้งเตือนเกินงบ
      ไฟล์: `js/ui-budget.js`
      ทำ: มีช่องตั้งงบของทุกหมวดรายจ่าย (ว่างหรือ 0 คือลบงบ) แสดงเฉพาะหมวดที่มีงบ พร้อมแถบสีและ "เกินงบ ฿X" และใช้ onAfterSave แจ้งเตือนเมื่อเกินงบ
      เกณฑ์ผ่าน: smoke test ผ่าน

- [x] 8. ตั้งค่า: หมวด และ Export/Import
      ไฟล์: `js/ui-settings.js`
      ทำ: เพิ่ม เปลี่ยนชื่อ และลบหมวด (ลบต้อง confirm) มี Export JSON, Export CSV และ Import ที่ใช้ FileReader + validateImport แล้ว confirm "แทนที่ข้อมูลทั้งหมดในเครื่องนี้?" ก่อน และรีเซ็ต input file ทุกครั้ง
      เกณฑ์ผ่าน: smoke test ผ่าน และ unit test ยังเป็น PASS

- [x] 9. ตรวจรับตามเกณฑ์ในสเปกทั้งหมด + แก้จุดที่พบ
      ไฟล์: ไฟล์ที่เกี่ยวข้องกับจุดที่พบ
      ทำ: รันคำสั่งตรวจทั้ง 2 ข้อ ทดสอบผ่าน static server ที่ทำจาก HttpListener และไล่เกณฑ์ใน SPEC.md ทีละข้อ
      เกณฑ์ผ่าน: อัตโนมัติผ่านหมด ส่วนเกณฑ์ที่ต้องลองด้วยมือให้ทำเป็น checklist ส่งให้ผู้ใช้

### เกณฑ์ที่ต้องลองด้วยมือ (ผู้ใช้)
- สีของแถวและแถบงบ และหน้าตากราฟ
- หน้าต่าง confirm ทั้ง 3 จุด
- แจ้งเตือนเกินงบ
- ปิดแล้วเปิดใหม่ข้อมูลยังอยู่ และดู Local Storage ใน DevTools
- Export ชื่อไฟล์ และการ import กลับ
- CSV ใน Excel
- หน้าจอ 360px
- Network และ Console
- อุปกรณ์จริง (Edge, Chrome Android, Safari iOS) โดยเฉพาะการดาวน์โหลดบน iOS

## ปัญหาค้าง
- (ปิดแล้ว) Console error ตรวจได้ด้วย chrome --enable-logging=stderr ไม่พบ error
- Blob download บน Safari iOS อาจเปิดไฟล์ในแท็บใหม่แทนการดาวน์โหลด ต้องลองบนเครื่องจริง
- Excel อาจแปลงคอลัมน์วันที่ตาม locale ของเครื่อง ไม่ผิดสเปก
- ผลรวม % ในคำอธิบายสีอาจได้ 99.9% หรือ 100.1% เพราะการปัด

## Log
- 2026-11-26 วางแผนเสร็จ (planner) ยืนยันแล้วว่า Chrome headless dump-dom ใช้ได้
- 2026-11-26 ขั้นที่ 4 — index.html + css/style.css (สัญญา id 50 ตัว) — verifier PASS (รอบที่ 1) หมายเหตุสำหรับขั้น 5: app.js ต้องสลับ hidden ของ tx-empty เอง
- 2026-11-26 ขั้นที่ 1-3 — money/data/reports + unit test — verifier FAIL รอบ 1 (pie arc เกือบ 360° หาย, lookup {} ชน Object.prototype) แก้แล้ว + เพิ่มเทส 2 ข้อ — verifier PASS (รอบที่ 2) unit 42/42
- 2026-11-26 ขั้นที่ 5 — app.js — verifier FAIL รอบ 1 (ช่องแก้ไขยอดใช้ float) แก้เป็น formatPlain — verifier PASS (รอบที่ 2)
- 2026-11-26 ขั้นที่ 6 — ui-charts.js (ตัดคำอธิบายสีซ้ำ) — verifier PASS (รอบที่ 1)
- 2026-11-26 ขั้นที่ 7 — ui-budget.js — verifier FAIL รอบ 1 (ช่องงบใช้ float) แก้เป็น formatPlain — ตรวจซ้ำ unit 42/42 + harness7 ALL PASS (รอบที่ 2)
- 2026-11-26 ขั้นที่ 8 — ui-settings.js — verifier PASS (รอบที่ 1)
- 2026-11-26 ขั้นที่ 9 / เฟส 4 — ตรวจรวมตาม SPEC: acceptance harness 153/153 (file:// และ http ผ่าน HttpListener), unit 42/42, 360px ไม่ล้น, ไม่มี request ภายนอก, console ไม่มี error — verifier PASS (รอบที่ 1)
- 2026-11-26 แก้เพิ่มหลังตรวจรวม — app.js กันเขียนทับเมื่อเปิด 2 แท็บ (ฟัง storage event + เช็คก่อน commit) — unit 42/42, acceptance 153/153, harness5 ผ่าน, twotab ข้อมูลแท็บแรกไม่หาย
