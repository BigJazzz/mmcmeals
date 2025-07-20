// Get the Spreadsheet ID from the properties you just set.
const SCRIPT_PROPS = PropertiesService.getScriptProperties();
const SPREADSHEET_ID = SCRIPT_PROPS.getProperty('SPREADSHEET_ID');

/**
 * Handles GET requests to the web app.
 * This is used to fetch the current list of meals.
 * Example call: fetch('YOUR_SCRIPT_URL?action=getMeals')
 */
function doGet(e) {
  const action = e.parameter.action;
  let responseData;

  if (action === 'getMeals') {
    responseData = getMeals();
  } else {
    responseData = { status: 'error', message: 'Invalid action' };
  }

  // Return the data as JSON
  return ContentService
    .createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles POST requests to the web app.
 * This is used for updating or uploading meals.
 */
function doPost(e) {
  const requestData = JSON.parse(e.postData.contents);
  const action = requestData.action;
  let responseData;

  try {
    if (action === 'updateMealStatus') {
      updateMealStatus(requestData.payload);
      responseData = { status: 'success', message: 'Meal status updated.' };
    } else if (action === 'uploadNewList') {
      uploadNewList(requestData.payload);
      responseData = { status: 'success', message: 'New list uploaded.' };
    } else {
      responseData = { status: 'error', message: 'Invalid POST action' };
    }
  } catch (err) {
    responseData = { status: 'error', message: 'An error occurred: ' + err.message };
  }

  // Return a success/error message as JSON
  return ContentService
    .createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- HELPER FUNCTIONS ---

/**
 * Retrieves all meals from the spreadsheet.
 */
function getMeals() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Sheet1');
  const range = sheet.getRange('A2:B' + sheet.getLastRow()); // Get all rows with data
  const values = range.getValues();

  const meals = values.map((row, index) => {
    if (row[0]) { // Ensure the row is not empty
      return {
        name: row[0],
        eaten: row[1] === true, // Checkboxes in sheets become true/false
        row: index + 2 // +2 because range starts at A2
      };
    }
  }).filter(meal => meal); // Filter out any empty rows

  return meals;
}

/**
 * Updates the 'Eaten' status for a specific meal.
 * @param {object} payload - An object like { row: 3, eaten: true }
 */
function updateMealStatus(payload) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Sheet1');
  // Update the checkbox in column B for the specified row
  sheet.getRange('B' + payload.row).setValue(payload.eaten);
}

/**
 * Deletes marked rows and uploads a new list of meals.
 * @param {object} payload - An object like { mealsToDelete: [3, 5], newMeals: ['Tacos', 'Pizza'] }
 */
function uploadNewList(payload) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Sheet1');

  // 1. Delete eaten meals. Iterate backwards to avoid shifting row indices.
  payload.mealsToDelete.sort((a, b) => b - a).forEach(rowIndex => {
    sheet.deleteRow(rowIndex);
  });
  
  // 2. Clear any remaining old meals
  const lastRow = sheet.getLastRow();
  if(lastRow >= 2) {
    sheet.getRange('A2:B' + lastRow).clearContent();
  }

  // 3. Add the new meals if any exist
  if (payload.newMeals.length > 0) {
    const newValues = payload.newMeals.map(mealName => [mealName, false]);
    sheet.getRange(2, 1, newValues.length, 2).setValues(newValues);
  }
}