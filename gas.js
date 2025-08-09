const SCRIPT_PROPS = PropertiesService.getScriptProperties();
const SCRIPT_ID = SCRIPT_PROPS.getProperty('SPREADSHEET_ID');

/**
 * Updates the timestamp in cell E1 to track changes.
 */
function updateTimestamp() {
  const sheet = SpreadsheetApp.openById(SCRIPT_ID).getSheetByName('MealList');
  sheet.getRange('E1').setValue(new Date().toISOString());
}

/**
 * MODIFIED: Makes the ID comparison more robust by treating both values as strings.
 */
function checkLastEmail() {
  const sheet = SpreadsheetApp.openById(SCRIPT_ID).getSheetByName('MealList');
  // Get the stored ID and convert it to a string, removing any whitespace
  const lastImportedId = sheet.getRange('G1').getValue().toString().trim();

  const searchSender = "team@mymusclechef.com.au";
  const searchSubject = "order confirmation";
  const searchTime = "14d";
  const query = `from:${searchSender} subject:(${searchSubject}) is:unread newer_than:${searchTime}`;
  const threads = GmailApp.search(query, 0, 1);

  if (threads.length === 0) {
    return { status: 'no_new_email' };
  }

  // Get the new ID and ensure it's also a clean string
  const latestUnreadEmailId = threads[0].getId().toString().trim();
  
  // Now, the comparison will be accurate
  if (latestUnreadEmailId === lastImportedId) {
    return { status: 'confirmation_needed', message: 'The newest unread email has already been imported. Do you want to import it again?' };
  } else {
    return { status: 'new_email_found' };
  }
}

/**
 * Takes assignment data from the webpage and updates the sheet.
 */
function saveAssignments(payload) {
  const sheet = SpreadsheetApp.openById(SCRIPT_ID).getSheetByName('MealList');
  payload.forEach(item => {
    sheet.getRange(`C${item.row}`).setValue(item.jarryd);
    sheet.getRange(`D${item.row}`).setValue(item.nathan);
  });
  updateTimestamp();
  return { status: 'success', message: 'Assignments saved!' };
}

/**
 * Decrements the quantity for a specific person AND the total quantity.
 */
function decrementPersonQuantity(payload) {
  const sheet = SpreadsheetApp.openById(SCRIPT_ID).getSheetByName('MealList');
  const personColumn = payload.person.toLowerCase() === 'jarryd' ? 'C' : 'D';
  const personQtyCell = sheet.getRange(personColumn + payload.row);
  const totalQtyCell = sheet.getRange('B' + payload.row);
  
  const currentPersonQty = personQtyCell.getValue();
  const currentTotalQty = totalQtyCell.getValue();

  if (currentPersonQty > 0) {
    personQtyCell.setValue(currentPersonQty - 1);
    if (currentTotalQty > 0) {
      totalQtyCell.setValue(currentTotalQty - 1);
    }
    updateTimestamp();
    return { status: 'success' };
  } else {
    return { status: 'info', message: 'Quantity already at 0.' };
  }
}

/**
 * Imports meals, increments totals for existing meals, and appends new ones.
 */
function importMealsFromGmailForWebApp() {
  try {
    const searchSender = "team@mymusclechef.com.au";
    const searchSubject = "order confirmation";
    const searchTime = "14d";
    const query = `from:${searchSender} subject:(${searchSubject}) is:unread newer_than:${searchTime}`;
    const threads = GmailApp.search(query, 0, 1);

    if (threads.length === 0) return { status: 'info', message: 'No new meal emails found.' };
    
    const message = threads[0].getMessages().pop();
    const emailBody = message.getPlainBody();
    const latestEmailId = threads[0].getId();
    
    const mealRegex = /^([\w\s&'’é,-]+?)\s+x(\d+)/gm;
    let importedMeals = [];
    let match;
    while ((match = mealRegex.exec(emailBody)) !== null) {
      const mealName = match[1].trim();
      if (!/ITEMS ORDERED|Subtotal|Shipping|Discount|GST|TOTAL/i.test(mealName)) {
        importedMeals.push({ name: mealName, qty: parseInt(match[2], 10) });
      }
    }

    if (importedMeals.length === 0) return { status: 'info', message: 'Found email, but could not extract any meals.' };

    const sheet = SpreadsheetApp.openById(SCRIPT_ID).getSheetByName('MealList');
    const lastRow = sheet.getLastRow();
    const existingMeals = new Map();
    if (lastRow >= 2) {
        const range = sheet.getRange('A2:B' + lastRow);
        const values = range.getValues();
        values.forEach((row, index) => {
            if (row[0]) existingMeals.set(row[0], { row: index + 2, total: row[1] });
        });
    }

    const mealsToAppend = [];
    importedMeals.forEach(meal => {
        if (existingMeals.has(meal.name)) {
            const existing = existingMeals.get(meal.name);
            const newTotal = existing.total + meal.qty;
            sheet.getRange(`B${existing.row}`).setValue(newTotal);
        } else {
            mealsToAppend.push([meal.name, meal.qty, 0, 0]);
        }
    });

    if (mealsToAppend.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, mealsToAppend.length, 4).setValues(mealsToAppend);
    }
    
    sheet.getRange('G1').setValue(latestEmailId);
    message.markRead();
    updateTimestamp();
    return { status: 'success', message: `Meal list updated successfully.` };
  } catch (err) {
    return { status: 'error', message: 'An error occurred during import: ' + err.message };
  }
}

/**
 * Fetches all meal data from the sheet.
 */
function getMeals() {
  const sheet = SpreadsheetApp.openById(SCRIPT_ID).getSheetByName('MealList');
  if (sheet.getLastRow() < 2) return [];
  const range = sheet.getRange('A2:D' + sheet.getLastRow());
  const values = range.getValues();
  return values.map((row, index) => {
    if (row[0]) {
      return {
        name: row[0],
        total: row[1],
        jarryd: row[2],
        nathan: row[3],
        row: index + 2
      };
    }
  }).filter(Boolean);
}

// --- WEB APP HANDLERS ---
function doGet(e) {
  try {
    const action = e.parameter.action;
    let data;
    if (!action) {
      // If no action is specified, return a default success response.
      // This helps with some preflight checks that don't pass parameters.
      data = { status: 'success', message: 'API is reachable.' };
    } else if (action === 'getMeals') {
      data = getMeals();
    } else if (action === 'checkLastEmail') {
      data = checkLastEmail();
    } else if (action === 'importFromGmail') {
      data = importMealsFromGmailForWebApp();
    } else if (action === 'getLastUpdate') {
      const sheet = SpreadsheetApp.openById(SCRIPT_ID).getSheetByName('MealList');
      data = { lastUpdate: sheet.getRange('E1').getValue() };
    } else {
      data = { status: 'error', message: 'Invalid action' };
    }
    return jsonResponse(data);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', data: yourData }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // This will log the detailed error message to the execution logs
    Logger.log(error);

    // You can also return a JSON error response to the app
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.message,
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const requestData = JSON.parse(e.postData.contents);
  let data;
  if (requestData.action === 'decrementPersonQty') {
    data = decrementPersonQuantity(requestData.payload);
  } else if (requestData.action === 'saveAssignments') {
    data = saveAssignments(requestData.payload);
  } else {
    data = { status: 'error', message: 'Invalid POST action' };
  }
  return jsonResponse(data);
}

function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON)
        .addHeader("Access-Control-Allow-Origin", "*")
        .addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        .addHeader("Access-Control-Allow-Headers", "Content-Type");
}

// --- MANUAL TRIGGERS ---
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Meal Importer').addItem('Import Meals from Gmail', 'importMealsFromGmail').addToUi();
}
function importMealsFromGmail() {
  const result = importMealsFromGmailForWebApp();
  if (result.message) SpreadsheetApp.getUi().alert(result.message);
}

function doOptions(e) {
  return ContentService.createTextOutput()
    .addHeader("Access-Control-Allow-Origin", "*")
    .addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .addHeader("Access-Control-Allow-Headers", "Content-Type");
}