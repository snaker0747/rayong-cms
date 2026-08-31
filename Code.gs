/**
 * ========================================================================================
 * ระบบบริหารสัญญา (Contract Management System: CMS)
 * ฝ่ายสาธารณูปโภค ส่วนการโยธา สำนักช่าง เทศบาลนครระยอง
 * 
 * พัฒนาตาม: ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560
 * - ข้อ 176(5): ตรวจรับงานก่อสร้างให้แล้วเสร็จภายใน 3 วันทำการ
 * - ข้อ 181: สัญญาครบกำหนดแต่ยังไม่ส่งมอบงาน ให้ออกหนังสือแจ้งปรับภายใน 7 วันทำการ
 * - ข้อ 183: ค่าปรับสะสมเกินร้อยละ 10 ของวงเงินสัญญา พิจารณาใช้สิทธิบอกเลิกสัญญา
 * ========================================================================================
 */

// ==========================================
// 1. การตั้งค่าระบบ (SYSTEM CONFIGURATION)
// ==========================================
const CONFIG = {
  // รหัส Google Sheets (เว้นว่างไว้ หากสคริปต์นี้ผูกอยู่กับ Google Sheets โดยตรง)
  SPREADSHEET_ID: "", 

  // รหัสโฟลเดอร์ Google Drive สำหรับเก็บรูปภาพหน้างาน
  DRIVE_FOLDER_ID: "1Fy4qA_k4YAMK8O6vlxuU88_TupK4ZYTe",

  // อีเมลเจ้าหน้าที่พัสดุ / แอดมิน เพื่อรับการแจ้งเตือนค่าปรับและ SLA (ระบุได้หลายอีเมล คั่นด้วยจุลภาค)
  OFFICER_EMAILS: "procurement@rayongcity.go.th",

  // ชื่อชีตในระบบฐานข้อมูล
  SHEET_NAMES: {
    CONTRACT_MASTER: "ContractMaster",
    DAILY_LOGS: "DailyLogs",
    INSPECTIONS: "Inspections",
    USERS: "Users"
  }
};

/**
 * ฟังก์ชันเริ่มต้นเชื่อมต่อ Google Spreadsheet
 */
function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== "" && CONFIG.SPREADSHEET_ID !== "YOUR_SPREADSHEET_ID_HERE") {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * ==========================================
 * 2. WEB APPLICATION ENTRY POINT (doGet)
 * ==========================================
 */

/**
 * ==========================================
 * 2.1 ระบบตรวจสอบสิทธิ์และผู้ใช้งาน (AUTHENTICATION & RBAC)
 * ==========================================
 */
function initUsersSheetIfMissing() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.USERS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.USERS);
    const headers = ["UserID", "Username", "Password", "FullName", "Role", "Department", "Status", "LastLogin"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d1e7dd");
    sheet.setFrozenRows(1);

    const defaultUsers = [
      ["USR-001", "admin", "admin", "ผู้ดูแลระบบ สำนักช่าง", "Admin", "ฝ่ายสาธารณูปโภค ส่วนการโยธา สำนักช่าง", "Active", ""],
      ["USR-002", "somchai", "1234", "นายสมชาย ใจมั่น (วิศวกรโยธาชำนาญการ)", "User", "ฝ่ายสาธารณูปโภค ส่วนการโยธา", "Active", ""],
      ["USR-003", "somsak", "1234", "นายสมศักดิ์ วงศ์ดี (นายช่างโยธาชำนาญงาน)", "User", "ฝ่ายสาธารณูปโภค ส่วนการโยธา", "Active", ""],
      ["USR-004", "wichai", "1234", "นายวิชัย ช่างทอง (นายช่างโยธาปฏิบัติงาน)", "User", "ฝ่ายสาธารณูปโภค ส่วนการโยธา", "Active", ""]
    ];
    sheet.getRange(2, 1, defaultUsers.length, headers.length).setValues(defaultUsers);
  }
  return sheet;
}

function loginUser(username, password) {
  try {
    const sheet = initUsersSheetIfMissing();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: false, message: "ไม่พบข้อมูลผู้ใช้งานในระบบ" };
    }

    const uInput = String(username || "").trim().toLowerCase();
    const pInput = String(password || "").trim();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const uDB = String(row[1] || "").trim().toLowerCase();
      const pDB = String(row[2] || "").trim();
      const status = String(row[6] || "Active").trim();

      if (uDB === uInput && pDB === pInput) {
        if (status.toLowerCase() === "inactive" || status === "ระงับการใช้งาน") {
          return { success: false, message: "บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
        }

        // Update LastLogin
        const nowStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
        sheet.getRange(i + 1, 8).setValue(nowStr);

        return {
          success: true,
          message: "เข้าสู่ระบบสำเร็จ",
          user: {
            userId: String(row[0] || ""),
            username: String(row[1] || ""),
            fullName: String(row[3] || ""),
            role: String(row[4] || "User"),
            department: String(row[5] || "ฝ่ายสาธารณูปโภค ส่วนการโยธา สำนักช่าง"),
            lastLogin: nowStr
          }
        };
      }
    }

    return { success: false, message: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" };
  } catch (error) {
    Logger.log("Error in loginUser: " + error.message);
    return { success: false, message: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: " + error.message };
  }
}

function getUserList() {
  try {
    const sheet = initUsersSheetIfMissing();
    const data = sheet.getDataRange().getValues();
    const users = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && !row[1]) continue;
      users.push({
        userId: String(row[0] || ""),
        username: String(row[1] || ""),
        fullName: String(row[3] || ""),
        role: String(row[4] || "User"),
        department: String(row[5] || ""),
        status: String(row[6] || "Active"),
        lastLogin: String(row[7] || "-")
      });
    }
    return { success: true, users: users };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function saveUserAccount(formData) {
  try {
    const sheet = initUsersSheetIfMissing();
    const data = sheet.getDataRange().getValues();
    const username = String(formData.username || "").trim().toLowerCase();
    const password = String(formData.password || "").trim();
    const fullName = String(formData.fullName || "").trim();
    const role = String(formData.role || "User").trim();
    const department = String(formData.department || "ฝ่ายสาธารณูปโภค ส่วนการโยธา").trim();
    const status = String(formData.status || "Active").trim();

    if (!username || !fullName) {
      return { success: false, message: "กรุณาระบุ Username และ ชื่อ-สกุล" };
    }

    // Check if user already exists -> update
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1] || "").trim().toLowerCase() === username) {
        if (password) sheet.getRange(i + 1, 3).setValue(password);
        sheet.getRange(i + 1, 4).setValue(fullName);
        sheet.getRange(i + 1, 5).setValue(role);
        sheet.getRange(i + 1, 6).setValue(department);
        sheet.getRange(i + 1, 7).setValue(status);
        return { success: true, message: "อัปเดตข้อมูลผู้ใช้งาน " + username + " เรียบร้อยแล้ว" };
      }
    }

    // New user
    const nextRow = sheet.getLastRow();
    const userId = "USR-" + (nextRow < 10 ? "00" : nextRow < 100 ? "0" : "") + nextRow;
    sheet.appendRow([userId, username, password || "1234", fullName, role, department, status, ""]);
    return { success: true, message: "เพิ่มผู้ใช้งานใหม่ " + username + " เรียบร้อยแล้ว" };
  } catch (error) {
    return { success: false, message: "เกิดข้อผิดพลาดในการบันทึกผู้ใช้: " + error.message };
  }
}


/**
 * ==========================================
 * 2.2 ระบบจัดการการตั้งค่าระบบ (SYSTEM SETTINGS)
 * ==========================================
 */
function getSystemSettings() {
  try {
    const props = PropertiesService.getScriptProperties().getProperties();
    return {
      success: true,
      settings: {
        orgName: props.orgName || "เทศบาลนครระยอง",
        deptName: props.deptName || "สำนักช่าง",
        divisionName: props.divisionName || "ฝ่ายสาธารณูปโภค ส่วนการโยธา",
        fiscalYear: props.fiscalYear || "2569",
        slaInspectionDays: Number(props.slaInspectionDays || 3),
        slaPenaltyNoticeDays: Number(props.slaPenaltyNoticeDays || 7),
        penaltyCancelPercent: Number(props.penaltyCancelPercent || 10),
        warningDaysAhead: Number(props.warningDaysAhead || 30),
        defaultPenaltyRate: Number(props.defaultPenaltyRate || 0.001),
        officerEmails: props.officerEmails || CONFIG.OFFICER_EMAILS || "procurement@rayongcity.go.th",
        enableEmailAlerts: props.enableEmailAlerts !== "false",
        lineNotifyToken: props.lineNotifyToken || "",
        driveFolderId: props.driveFolderId || CONFIG.DRIVE_FOLDER_ID,
        maxPhotoWidth: Number(props.maxPhotoWidth || 1280),
        photoQuality: Number(props.photoQuality || 0.75)
      }
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function saveSystemSettings(settings) {
  try {
    const props = PropertiesService.getScriptProperties();
    const toSave = {};
    for (let key in settings) {
      toSave[key] = String(settings[key]);
    }
    props.setProperties(toSave);
    return {
      success: true,
      message: "บันทึกการตั้งค่าระบบเรียบร้อยแล้ว"
    };
  } catch (error) {
    return {
      success: false,
      message: "เกิดข้อผิดพลาดในการบันทึกการตั้งค่า: " + error.message
    };
  }
}

/**
 * ==========================================
 * 2. WEB APPLICATION & REST API (doGet / doPost)
 * รองรับทั้งการเปิดผ่าน Google Apps Script และ Vercel.app
 * ==========================================
 */
function doGet(e) {
  // หากมีการส่ง Query parameter action (เช่น action=getDashboardData) ให้ตอบกลับเป็น JSON REST API
  if (e && e.parameter && e.parameter.action) {
    const action = e.parameter.action;
    let result = { success: false, message: "Unknown action" };

    try {
      if (action === "getDashboardData") {
        result = getDashboardData();
      } else if (action === "getContracts") {
        result = { success: true, contracts: getContracts() };
      } else if (action === "getSystemSettings") {
        result = getSystemSettings();
      } else if (action === "getUserList") {
        result = getUserList();
      } else if (action === "testConnection") {
        result = { success: true, message: "เชื่อมต่อ Google Apps Script API สำเร็จ 100%" };
      }
    } catch (err) {
      result = { success: false, message: err.message };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // กรณีเปิดเว็บตรงผ่าน Google Apps Script
  const template = HtmlService.createTemplateFromFile("Index");
  return template.evaluate()
    .setTitle("ระบบบริหารสัญญา - เทศบาลนครระยอง")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, shrink-to-fit=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let result = { success: false, message: "No data received" };

  try {
    let postData = {};
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    const action = postData.action || (e && e.parameter && e.parameter.action);

    if (action === "loginUser") {
      result = loginUser(postData.username, postData.password);
    } else if (action === "getDashboardData") {
      result = getDashboardData();
    } else if (action === "saveDailyLog") {
      result = saveDailyLog(postData.formData || postData);
    } else if (action === "saveInspection") {
      result = saveInspection(postData.formData || postData);
    } else if (action === "saveNewContract") {
      result = saveNewContract(postData.formData || postData);
    } else if (action === "saveUserAccount") {
      result = saveUserAccount(postData.formData || postData);
    } else if (action === "saveSystemSettings") {
      result = saveSystemSettings(postData.settings || postData);
    } else if (action === "getUserList") {
      result = getUserList();
    } else if (action === "testConnection") {
      result = { success: true, message: "เชื่อมต่อระบบ API และฐานข้อมูลสำเร็จ 100%" };
    } else {
      result = { success: false, message: "Action ไม่ถูกต้อง: " + action };
    }
  } catch (err) {
    result = { success: false, message: "เกิดข้อผิดพลาดในการประมวลผล: " + err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ==========================================
 * 3. ฟังก์ชันดึงข้อมูลสัญญาและสรุปภาพรวมแดชบอร์ด
 * ==========================================
 */
function getContracts() {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_MASTER);
    if (!sheet) {
      initDatabase();
      sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_MASTER);
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const contracts = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && !row[1]) continue;

      contracts.push({
        rowIndex: i + 1,
        contractId: String(row[0] || ""),
        contractNo: formatContractNo(row[1]),
        projectName: String(row[2] || ""),
        contractor: String(row[3] || ""),
        budget: Number(row[4] || 0),
        contractAmount: Number(row[5] || 0),
        penaltyRate: Number(row[6] || 0.001),
        startDate: formatDate(row[7]),
        endDate: formatDate(row[8]),
        status: String(row[9] || "Active"),
        responsibleEngineer: String(row[10] || "")
      });
    }

    return contracts;
  } catch (error) {
    Logger.log("Error in getContracts: " + error.message);
    throw new Error("ไม่สามารถดึงข้อมูลสัญญาได้: " + error.message);
  }
}

function getDashboardData() {
  try {
    const contracts = getContracts();
    const ss = getSpreadsheet();
    const dailySheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DAILY_LOGS);

    const latestProgressMap = {};
    const recentLogs = [];
    if (dailySheet && dailySheet.getLastRow() > 1) {
      const dailyData = dailySheet.getDataRange().getValues();
      for (let i = 1; i < dailyData.length; i++) {
        const row = dailyData[i];
        const cNo = formatContractNo(row[1]);
        const progress = Number(row[6] || 0);
        const logDate = formatDate(row[2]);
        const ts = row[12];
        
        if (!latestProgressMap[cNo] || new Date(ts) > new Date(latestProgressMap[cNo].timestamp)) {
          latestProgressMap[cNo] = {
            progressPercent: progress,
            lastLogDate: logDate,
            timestamp: ts
          };
        }

        recentLogs.unshift({
          logId: String(row[0]),
          contractNo: cNo,
          logDate: logDate,
          weather: String(row[3] || "ปกติ/แจ่มใส"),
          laborCount: Number(row[4] || 0),
          machineryUsed: String(row[5] || "-"),
          progressPercent: progress,
          issues: String(row[7] || "-"),
          solution: String(row[8] || "-"),
          photoUrl: String(row[9] || ""),
          locationGPS: String(row[10] || ""),
          inspectorName: String(row[11] || ""),
          timestamp: String(ts || "")
        });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalBudget = 0;
    let totalContractAmount = 0;
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;
    let completedCount = 0;

    const enrichedContracts = contracts.map(function(contract) {
      totalBudget += contract.budget;
      totalContractAmount += contract.contractAmount;

      const progressInfo = latestProgressMap[contract.contractNo] || { progressPercent: 0, lastLogDate: "-" };
      contract.currentProgress = progressInfo.progressPercent;
      contract.lastLogDate = progressInfo.lastLogDate;

      const penaltyCalc = calculatePenaltyAndStatus(contract, today);
      contract.trafficStatus = penaltyCalc.trafficStatus;
      contract.daysOverdue = penaltyCalc.daysOverdue;
      contract.penaltyAmount = penaltyCalc.penaltyAmount;
      contract.penaltyPercent = penaltyCalc.penaltyPercent;
      contract.alertMessage = penaltyCalc.alertMessage;
      contract.remainingDays = penaltyCalc.remainingDays;

      if (contract.status === "Completed") {
        completedCount++;
      } else {
        if (contract.trafficStatus === "GREEN") greenCount++;
        else if (contract.trafficStatus === "YELLOW") yellowCount++;
        else if (contract.trafficStatus === "RED") redCount++;
      }

      return contract;
    });

    return {
      summary: {
        totalContracts: contracts.length,
        activeContracts: contracts.filter(function(c) { return c.status === "Active"; }).length,
        completedContracts: completedCount,
        greenCount: greenCount,
        yellowCount: yellowCount,
        redCount: redCount,
        totalBudget: totalBudget,
        totalContractAmount: totalContractAmount
      },
      contracts: enrichedContracts,
      recentLogs: recentLogs.slice(0, 20)
    };
  } catch (error) {
    Logger.log("Error in getDashboardData: " + error.message);
    throw new Error("ไม่สามารถประมวลผลข้อมูลแดชบอร์ดได้: " + error.message);
  }
}

/**
 * ==========================================
 * 4. การคำนวณค่าปรับและวิเคราะห์สถานะตามระเบียบฯ พ.ศ. 2560
 * ==========================================
 */
function calculatePenaltyAndStatus(contract, compareDate) {
  const today = compareDate || new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = parseDate(contract.endDate);
  
  let trafficStatus = "GREEN"; 
  let daysOverdue = 0;
  let penaltyAmount = 0;
  let penaltyPercent = 0;
  let alertMessage = "การดำเนินงานเป็นไปตามแผนงาน";
  let remainingDays = 0;

  if (!endDate) {
    return { 
      trafficStatus: trafficStatus, 
      daysOverdue: daysOverdue, 
      penaltyAmount: penaltyAmount, 
      penaltyPercent: penaltyPercent, 
      alertMessage: alertMessage, 
      remainingDays: remainingDays 
    };
  }

  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  remainingDays = diffDays;

  if (contract.status === "Completed") {
    return {
      trafficStatus: "COMPLETED",
      daysOverdue: 0,
      penaltyAmount: 0,
      penaltyPercent: 0,
      alertMessage: "โครงการส่งมอบและตรวจรับเรียบร้อยแล้ว",
      remainingDays: 0
    };
  }

  if (diffDays < 0) {
    daysOverdue = Math.abs(diffDays);
    const rate = contract.penaltyRate > 0 ? contract.penaltyRate : 0.001;
    penaltyAmount = contract.contractAmount * rate * daysOverdue;
    penaltyPercent = contract.contractAmount > 0 ? (penaltyAmount / contract.contractAmount) * 100 : 0;

    if (penaltyPercent >= 10) {
      trafficStatus = "RED";
      alertMessage = "🚨 วิกฤต! เกินสัญญา " + daysOverdue + " วัน ค่าปรับสะสม ฿" + formatNumber(penaltyAmount) + " (" + penaltyPercent.toFixed(2) + "%) เกินเกณฑ์ 10% เข้าเงื่อนไขพิจารณาบอกเลิกสัญญา (ระเบียบฯ ข้อ 183)";
    } else {
      trafficStatus = "RED";
      alertMessage = "⚠️ สิ้นสุดสัญญาแล้ว เกินกำหนด " + daysOverdue + " วัน ค่าปรับสะสม ฿" + formatNumber(penaltyAmount) + " (" + penaltyPercent.toFixed(2) + "%) ต้องออกหนังสือแจ้งปรับภายใน 7 วันทำการ (ระเบียบฯ ข้อ 181)";
    }
  } else if (diffDays <= 15) {
    trafficStatus = "YELLOW";
    alertMessage = "⏳ เตือน! เหลือเวลาตามสัญญาอีกเพียง " + diffDays + " วัน (สิ้นสุด " + contract.endDate + ") เร่งรัดติดตามงาน";
  } else {
    trafficStatus = "GREEN";
    alertMessage = "✅ ดำเนินการตามปกติ (เหลือเวลาอีก " + diffDays + " วัน)";
  }

  return {
    trafficStatus: trafficStatus,
    daysOverdue: daysOverdue,
    penaltyAmount: penaltyAmount,
    penaltyPercent: penaltyPercent,
    alertMessage: alertMessage,
    remainingDays: remainingDays
  };
}

/**
 * ==========================================
 * 5. ฟังก์ชันบันทึกตรวจงานประจำวัน (Daily Logs)
 * ==========================================
 */
function saveDailyLog(formData) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DAILY_LOGS);
    if (!sheet) {
      initDatabase();
      sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.DAILY_LOGS);
    }

    let photoUrl = "";
    if (formData.photoBase64 && formData.photoBase64.length > 50) {
      const rawContract = String(formData.contractNo || "NoContract");
      const cleanContract = rawContract.replace(/[^a-zA-Z0-9_฀-๿]/g, "_");
      const timeStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd_HHmmss");
      const fileName = "DailyLog_" + cleanContract + "_" + timeStr + ".jpg";
      photoUrl = uploadImageToDrive(formData.photoBase64, fileName);
    }

    const logId = "LOG-" + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyMMdd-HHmmss");
    const timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");

    const newRow = [
      logId,
      formData.contractNo || "",
      formData.logDate || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd"),
      formData.weather || "ปกติ/แจ่มใส",
      Number(formData.laborCount || 0),
      formData.machineryUsed || "",
      Number(formData.progressPercent || 0),
      formData.issues || "-",
      formData.solution || "-",
      photoUrl,
      formData.locationGPS || "",
      formData.inspectorName || "",
      timestamp
    ];

    sheet.appendRow(newRow);

    return {
      success: true,
      message: "บันทึกรายงานตรวจงานประจำวันเรียบร้อยแล้ว",
      logId: logId,
      photoUrl: photoUrl
    };
  } catch (error) {
    Logger.log("Error in saveDailyLog: " + error.message);
    return {
      success: false,
      message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message
    };
  }
}

/**
 * ==========================================
 * 6. ฟังก์ชันบันทึกการส่งมอบและตรวจรับงาน (Inspections)
 * ==========================================
 */
function saveInspection(formData) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.INSPECTIONS);
    if (!sheet) {
      initDatabase();
      sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.INSPECTIONS);
    }

    const inspectionId = "INSP-" + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyMMdd-HHmmss");
    const timestamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");

    const newRow = [
      inspectionId,
      formData.contractNo || "",
      formData.periodNo || "1",
      formData.deliveryDate || "",
      formData.committeeMeetDate || "",
      formData.inspectionResult || "ผ่านการตรวจรับ",
      formData.remarks || "-",
      formData.inspectorSign || "",
      formData.status || "Completed",
      timestamp
    ];

    sheet.appendRow(newRow);

    if (formData.sendNotification === true || formData.sendNotification === "true") {
      try {
        sendSlaNotificationEmail(formData.contractNo, "INSPECT_LIMIT", {
          periodNo: formData.periodNo,
          deliveryDate: formData.deliveryDate,
          committeeMeetDate: formData.committeeMeetDate,
          inspectorSign: formData.inspectorSign
        });
      } catch (mailErr) {
        Logger.log("Email notification failed: " + mailErr.message);
      }
    }

    return {
      success: true,
      message: "บันทึกการส่งมอบ/ตรวจรับงานเรียบร้อยแล้ว",
      inspectionId: inspectionId
    };
  } catch (error) {
    Logger.log("Error in saveInspection: " + error.message);
    return {
      success: false,
      message: "เกิดข้อผิดพลาดในการบันทึกตรวจรับ: " + error.message
    };
  }
}

/**
 * ==========================================
 * 7. ฟังก์ชันอัปโหลดรูปภาพลง Google Drive
 * ==========================================
 */
function uploadImageToDrive(base64Data, filename) {
  try {
    let folder;
    if (CONFIG.DRIVE_FOLDER_ID && CONFIG.DRIVE_FOLDER_ID.trim() !== "" && CONFIG.DRIVE_FOLDER_ID !== "YOUR_DRIVE_FOLDER_ID_HERE") {
      folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID.trim());
    } else {
      const folderName = "ระบบบริหารสัญญา_ภาพถ่ายตรวจงาน_เทศบาลนครระยอง";
      const folders = DriveApp.getFoldersByName(folderName);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
    }

    let cleanBase64 = base64Data;
    if (cleanBase64.indexOf(",") > -1) {
      cleanBase64 = cleanBase64.split(",")[1];
    }

    const decodedBytes = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decodedBytes, "image/jpeg", filename);

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
    return fileUrl;
  } catch (error) {
    Logger.log("Error in uploadImageToDrive: " + error.message);
    return "Error uploading image: " + error.message;
  }
}

/**
 * ==========================================
 * 7.1 ฟังก์ชันเพิ่มโครงการ/สัญญาใหม่ (New Contract)
 * ==========================================
 */
function saveNewContract(formData) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_MASTER);
    if (!sheet) {
      initDatabase();
      sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_MASTER);
    }

    const nextRow = sheet.getLastRow();
    const contractId = formData.contractId || ("CTR-69-" + (nextRow < 10 ? "00" : nextRow < 100 ? "0" : "") + nextRow);
    const contractNo = String(formData.contractNo || "").trim();
    const projectName = String(formData.projectName || "").trim();
    const contractor = String(formData.contractor || "").trim();
    const budget = Number(formData.budget || 0);
    const contractAmount = Number(formData.contractAmount || 0);
    const penaltyRate = Number(formData.penaltyRate || 0.001);
    const startDate = String(formData.startDate || "");
    const endDate = String(formData.endDate || "");
    const status = String(formData.status || "Active");
    const responsibleEngineer = String(formData.responsibleEngineer || "").trim();

    const newRowIndex = sheet.getLastRow() + 1;
    sheet.getRange(newRowIndex, 1, 1, 11).setValues([[
      contractId,
      "'" + contractNo,
      projectName,
      contractor,
      budget,
      contractAmount,
      penaltyRate,
      startDate,
      endDate,
      status,
      responsibleEngineer
    ]]);

    return {
      success: true,
      message: "บันทึกข้อมูลสัญญาโครงการใหม่เรียบร้อยแล้ว",
      contractNo: contractNo,
      contractId: contractId
    };
  } catch (error) {
    Logger.log("Error in saveNewContract: " + error.message);
    return {
      success: false,
      message: "เกิดข้อผิดพลาดในการบันทึกสัญญาใหม่: " + error.message
    };
  }
}

/**
 * ==========================================
 * 8. ฟังก์ชันแจ้งเตือนทางอีเมลตามระเบียบพัสดุฯ (SLA Notifications)
 * ==========================================
 */
function sendSlaNotificationEmail(contractNo, type, details) {
  try {
    const contracts = getContracts();
    const contract = contracts.find(function(c) { return c.contractNo === contractNo; });
    const projectName = contract ? contract.projectName : ("สัญญาเลขที่ " + contractNo);
    const contractor = contract ? contract.contractor : "-";
    const recipient = CONFIG.OFFICER_EMAILS;

    let subject = "";
    let htmlBody = "";

    if (type === "INSPECT_LIMIT") {
      subject = "🔔 [แจ้งเตือน SLA 3 วันทำการ] มีการส่งมอบงาน: สัญญาเลขที่ " + contractNo + " - " + projectName;
      htmlBody = '<div style="font-family: Sarabun, Tahoma, sans-serif; line-height: 1.6; color: #333; max-width: 650px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background-color: #ffffff;">' +
        '<div style="background-color: #0d47a1; color: #ffffff; padding: 12px 18px; border-radius: 6px; margin-bottom: 20px;">' +
        '<h2 style="margin: 0; font-size: 18px;">เทศบาลนครระยอง - ระบบบริหารสัญญา</h2>' +
        '<p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">ฝ่ายสาธารณูปโภค ส่วนการโยธา สำนักช่าง</p>' +
        '</div>' +
        '<h3 style="color: #0d47a1; margin-top: 0;">แจ้งเตือนกรอบเวลาตรวจรับงานตามระเบียบฯ (SLA 3 วันทำการ)</h3>' +
        '<p>เรียน คณะกรรมการตรวจรับพัสดุ และผู้ควบคุมงาน</p>' +
        '<div style="background-color: #f5f9ff; border-left: 4px solid #1976d2; padding: 14px; margin: 15px 0;">' +
        '<p style="margin: 4px 0;"><strong>เลขที่สัญญา:</strong> ' + contractNo + '</p>' +
        '<p style="margin: 4px 0;"><strong>ชื่อโครงการ:</strong> ' + projectName + '</p>' +
        '<p style="margin: 4px 0;"><strong>ผู้รับจ้าง:</strong> ' + contractor + '</p>' +
        '<p style="margin: 4px 0;"><strong>งวดงานที่ส่งมอบ:</strong> งวดที่ ' + (details.periodNo || "1") + '</p>' +
        '<p style="margin: 4px 0;"><strong>วันที่ผู้รับจ้างส่งงาน:</strong> ' + (details.deliveryDate || "-") + '</p>' +
        '<p style="margin: 4px 0;"><strong>วันนัดตรวจรับงาน:</strong> ' + (details.committeeMeetDate || "-") + '</p>' +
        '</div>' +
        '<div style="background-color: #fff3cd; color: #856404; padding: 12px; border-radius: 4px; font-size: 13px; margin-bottom: 18px;">' +
        '📌 <strong>ข้อกำหนดตามกฎหมาย:</strong> ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างฯ พ.ศ. 2560 ข้อ 176 (5) กำหนดให้คณะกรรมการตรวจรับพัสดุในงานจ้างก่อสร้าง ต้องดำเนินการตรวจรับงานให้แล้วเสร็จ<strong>ภายใน 3 วันทำการ</strong> นับแต่วันที่ประธานกรรมการได้รับมอบงาน' +
        '</div>' +
        '<p style="font-size: 12px; color: #777;">อีเมลฉบับนี้เป็นการแจ้งเตือนอัตโนมัติจากระบบบริหารสัญญา เทศบาลนครระยอง</p>' +
        '</div>';
    } else if (type === "PENALTY_ALERT") {
      const penaltyCalc = calculatePenaltyAndStatus(contract || { contractAmount: 0, penaltyRate: 0.001, endDate: "" });
      subject = "🚨 [แจ้งเตือนสัญญาเกินกำหนด] สัญญาเลขที่ " + contractNo + " ครบกำหนดแล้ว - ต้องออกหนังสือแจ้งปรับภายใน 7 วัน";
      htmlBody = '<div style="font-family: Sarabun, Tahoma, sans-serif; line-height: 1.6; color: #333; max-width: 650px; border: 1px solid #ffcdd2; border-radius: 8px; padding: 24px; background-color: #ffffff;">' +
        '<div style="background-color: #c62828; color: #ffffff; padding: 12px 18px; border-radius: 6px; margin-bottom: 20px;">' +
        '<h2 style="margin: 0; font-size: 18px;">เทศบาลนครระยอง - แจ้งเตือนสัญญาเกินกำหนด</h2>' +
        '<p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">ฝ่ายสาธารณูปโภค ส่วนการโยธา สำนักช่าง</p>' +
        '</div>' +
        '<h3 style="color: #c62828; margin-top: 0;">สัญญาครบกำหนดระยะเวลาส่งมอบงาน</h3>' +
        '<p>เรียน เจ้าหน้าที่พัสดุ และผู้ควบคุมงาน</p>' +
        '<div style="background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 14px; margin: 15px 0;">' +
        '<p style="margin: 4px 0;"><strong>เลขที่สัญญา:</strong> ' + contractNo + '</p>' +
        '<p style="margin: 4px 0;"><strong>ชื่อโครงการ:</strong> ' + projectName + '</p>' +
        '<p style="margin: 4px 0;"><strong>ผู้รับจ้าง:</strong> ' + contractor + '</p>' +
        '<p style="margin: 4px 0;"><strong>วันสิ้นสุดสัญญา:</strong> ' + (contract ? contract.endDate : "-") + '</p>' +
        '<p style="margin: 4px 0;"><strong>จำนวนวันล่วงเลย:</strong> ' + penaltyCalc.daysOverdue + ' วัน</p>' +
        '<p style="margin: 4px 0; color: #c62828;"><strong>ค่าปรับสะสมโดยประมาณ:</strong> ฿' + formatNumber(penaltyCalc.penaltyAmount) + ' (' + penaltyCalc.penaltyPercent.toFixed(2) + '%)</p>' +
        '</div>' +
        '<div style="background-color: #fff3cd; color: #856404; padding: 12px; border-radius: 4px; font-size: 13px; margin-bottom: 18px;">' +
        '📌 <strong>ข้อกำหนดตามกฎหมาย:</strong>' +
        '<ul style="margin: 5px 0 0 18px; padding: 0;">' +
        '<li><strong>ระเบียบฯ ข้อ 181:</strong> เมื่อสัญญาสิ้นสุดลงแล้ว ให้หน่วยงานของรัฐมีหนังสือแจ้งการปรับตามสัญญาให้คู่สัญญาและผู้ค้ำประกันทราบ<strong>ภายใน 7 วันทำการ</strong></li>' +
        '<li><strong>ระเบียบฯ ข้อ 183:</strong> หากค่าปรับจะเกินร้อยละ 10 ของวงเงินค่าจ้าง ให้พิจารณาใช้สิทธิบอกเลิกสัญญา เว้นแต่คู่สัญญายอมชำระค่าปรับโดยไม่มีเงื่อนไข</li>' +
        '</ul>' +
        '</div>' +
        '<p style="font-size: 12px; color: #777;">ระบบบริหารสัญญา ฝ่ายสาธารณูปโภค ส่วนการโยธา สำนักช่าง เทศบาลนครระยอง</p>' +
        '</div>';
    }

    if (recipient && recipient.indexOf("YOUR_EMAIL") === -1 && recipient.indexOf("procurement@rayongcity.go.th") === -1) {
      GmailApp.sendEmail(recipient, subject, "", {
        htmlBody: htmlBody
      });
      Logger.log("Email sent successfully to " + recipient + " for " + contractNo);
    } else {
      Logger.log("Notification prepared: " + subject);
    }
  } catch (error) {
    Logger.log("Error in sendSlaNotificationEmail: " + error.message);
  }
}

/**
 * ==========================================
 * 9. ฟังก์ชันสร้างตารางเริ่มต้นอัตโนมัติ (Database Initializer)
 * ==========================================
 */
function initDatabase() {
  const ss = getSpreadsheet();
  
  // 1. ชีต ContractMaster
  let sheetContract = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_MASTER);
  if (!sheetContract) {
    sheetContract = ss.insertSheet(CONFIG.SHEET_NAMES.CONTRACT_MASTER);
    const contractHeaders = [
      "ContractID", "ContractNo", "ProjectName", "Contractor", 
      "Budget", "ContractAmount", "PenaltyRate", "StartDate", "EndDate", "Status", "ResponsibleEngineer"
    ];
    sheetContract.getRange(1, 1, 1, contractHeaders.length).setValues([contractHeaders]);
    sheetContract.getRange(1, 1, 1, contractHeaders.length).setFontWeight("bold").setBackground("#e3f2fd");
    sheetContract.setFrozenRows(1);

    const sampleContracts = [
      ["CTR-69-001", "12/2569", "โครงการก่อสร้างปรับปรุงระบบระบายน้ำและบาทวิถี ถนนตากสินมหาราช", "ห้างหุ้นส่วนจำกัด ระยองการโยธา 2024", 2500000, 2380000, 0.001, "2026-05-01", "2026-10-31", "Active", "นายสมชาย ใจมั่น (วิศวกรโยธาชำนาญการ)"],
      ["CTR-69-002", "15/2569", "โครงการติดตั้งไฟฟ้าส่องสว่างพลังงานแสงอาทิตย์ (Solar Street Light) ซอยสุขุมวิท 45", "บริษัท ระยองโซลาร์เทค จำกัด", 1800000, 1750000, 0.001, "2026-06-15", "2026-09-15", "Active", "นายสมศักดิ์ วงศ์ดี (นายช่างไฟฟ้าชำนาญงาน)"],
      ["CTR-69-003", "08/2569", "โครงการปรับปรุงผิวจราจรแอสฟัลต์คอนกรีต ถนนราษฎร์บำรุง สาย ค", "ห้างหุ้นส่วนจำกัด ทรัพย์อนันต์วิศวกรรม", 4500000, 4290000, 0.001, "2026-01-10", "2026-07-31", "Active", "นายวิชัย ช่างทอง (นายช่างโยธาชำนาญงาน)"]
    ];
    sheetContract.getRange(2, 1, sampleContracts.length, contractHeaders.length).setValues(sampleContracts);
  }

  // 2. ชีต DailyLogs
  let sheetDaily = ss.getSheetByName(CONFIG.SHEET_NAMES.DAILY_LOGS);
  if (!sheetDaily) {
    sheetDaily = ss.insertSheet(CONFIG.SHEET_NAMES.DAILY_LOGS);
    const dailyHeaders = [
      "LogID", "ContractNo", "LogDate", "Weather", "LaborCount", 
      "MachineryUsed", "ProgressPercent", "Issues", "Solution", "PhotoUrl", "LocationGPS", "InspectorName", "Timestamp"
    ];
    sheetDaily.getRange(1, 1, 1, dailyHeaders.length).setValues([dailyHeaders]);
    sheetDaily.getRange(1, 1, 1, dailyHeaders.length).setFontWeight("bold").setBackground("#e8f5e9");
    sheetDaily.setFrozenRows(1);

    const sampleLogs = [
      ["LOG-690801-093000", "12/2569", "2026-08-25", "ปกติ/แจ่มใส", 12, "รถขุดเล็ก 1 คัน, รถบรรทุก 6 ล้อ 2 คัน", 65, "พบแนวท่อประปาเก่าขวางแนวขุดวางท่อระบายน้ำ", "ประสานการประปาส่วนภูมิภาคเข้าตัดประสานท่อ", "", "12.6815, 101.2816", "นายสมชาย ใจมั่น", "25/08/2026 16:30:00"],
      ["LOG-690802-101500", "15/2569", "2026-08-26", "ปกติ/แจ่มใส", 6, "รถกระเช้าไฟฟ้า 1 คัน", 85, "ไม่มี", "ดำเนินการติดตั้งเสาและโคมไฟตามแผน", "", "12.6789, 101.2754", "นายสมศักดิ์ วงศ์ดี", "26/08/2026 17:00:00"]
    ];
    sheetDaily.getRange(2, 1, sampleLogs.length, dailyHeaders.length).setValues(sampleLogs);
  }

  // 3. ชีต Inspections
  let sheetInspect = ss.getSheetByName(CONFIG.SHEET_NAMES.INSPECTIONS);
  if (!sheetInspect) {
    sheetInspect = ss.insertSheet(CONFIG.SHEET_NAMES.INSPECTIONS);
    const inspectHeaders = [
      "InspectionID", "ContractNo", "PeriodNo", "DeliveryDate", 
      "CommitteeMeetDate", "InspectionResult", "Remarks", "InspectorSign", "Status", "Timestamp"
    ];
    sheetInspect.getRange(1, 1, 1, inspectHeaders.length).setValues([inspectHeaders]);
    sheetInspect.getRange(1, 1, 1, inspectHeaders.length).setFontWeight("bold").setBackground("#fff3e0");
    sheetInspect.setFrozenRows(1);
  }

  return { success: true, message: "สร้างฐานข้อมูลเริ่มต้นใน Google Sheets เรียบร้อยแล้ว" };
}

/**
 * ==========================================
 * 10. ฟังก์ชันตัวช่วย (Helper Functions)
 * ==========================================
 */
function formatContractNo(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const m = val.getMonth() + 1;
    const y = val.getFullYear();
    const monthStr = m < 10 ? "0" + m : "" + m;
    return monthStr + "/" + y;
  }
  const str = String(val).trim();
  if (str.includes("GMT+") || str.includes("GMT-") || str.includes("เวลาอินโดจีน") || str.includes("Indochina")) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const monthStr = m < 10 ? "0" + m : "" + m;
      return monthStr + "/" + y;
    }
  }
  return str;
}

function formatDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Bangkok", "yyyy-MM-dd");
  }
  return String(val);
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const parts = String(val).split("-");
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function formatNumber(num) {
  return Number(num || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
