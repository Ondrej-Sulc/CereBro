import { auth, sheets, sheets_v4 } from "googleapis/build/src/apis/sheets";
import { config } from "../config";

/**
 * Service for interacting with Google Sheets.
 */
class SheetsService {
  private sheets: sheets_v4.Sheets;

  /**
   * Initializes the SheetsService by authenticating with Google.
   * @throws Will throw an error if GOOGLE_CREDENTIALS_JSON is not defined or invalid.
   */
  constructor() {
    const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
    const jwtClient = new auth.JWT({
      email: config.GOOGLE_CREDENTIALS.client_email,
      key: config.GOOGLE_CREDENTIALS.private_key,
      scopes,
    });
    this.sheets = sheets({ version: "v4", auth: jwtClient });
  }

  /**
   * Reads data from a specified range in a Google Sheet.
   * @param spreadsheetId The ID of the spreadsheet.
   * @param range The A1 notation of the range to retrieve.
   * @returns A 2D array of the data, or null if no data is found.
   */
  public async readSheet(
    spreadsheetId: string,
    range: string
  ): Promise<any[][] | null> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values || null;
  }

  /**
   * Reads data from multiple ranges in a Google Sheet in a single API call.
   * @param spreadsheetId The ID of the spreadsheet.
   * @param ranges An array of A1 notation strings of the ranges to retrieve.
   * @returns An array of 2D arrays of the data, corresponding to the order of the ranges, or null for ranges with no data.
   */
  public async readSheets(
    spreadsheetId: string,
    ranges: string[]
  ): Promise<(any[][] | null)[]> {
    const response = await this.sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
    });

    const valueRanges = response.data.valueRanges;
    if (!valueRanges) {
      return ranges.map(() => null);
    }

    return valueRanges.map((valueRange) => valueRange.values || null);
  }

  /**
   * Writes data to a specified range in a Google Sheet.
   * This will overwrite any existing data in the range.
   * @param spreadsheetId The ID of the spreadsheet.
   * @param range The A1 notation of the range to write to.
   * @param values A 2D array of data to write.
   * @returns The number of cells updated.
   */
  public async writeSheet(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<number> {
    const response = await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });
    return response.data.updatedCells || 0;
  }

  /**
   * Appends data to a sheet. This is useful for logging.
   * Google Sheets will find the first empty row in the table and add the data there.
   * @param spreadsheetId The ID of the spreadsheet.
   * @param range The A1 notation of the table to append to (e.g., 'Logs!A1').
   * @param values A 2D array of data to append.
   * @returns The number of cells appended.
   */
  public async appendSheet(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<number> {
    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values,
      },
    });
    return response.data.updates?.updatedCells || 0;
  }

  /**
   * Clears values from a spreadsheet.
   * @param spreadsheetId The spreadsheet to update.
   * @param range The A1 notation of the range to clear.
   * @returns The response from the API.
   */
  public async clearSheet(
    spreadsheetId: string,
    range: string
  ): Promise<sheets_v4.Schema$ClearValuesResponse> {
    const response = await this.sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });
    return response.data;
  }
}

export const sheetsService = new SheetsService();

export interface WarPlanData {
  assignments: any[][] | null;
  prefights: any[][] | null;
}

export async function getWarPlanData(
  battlegroup: number
): Promise<WarPlanData> {
  const sheetName = `AW BG${battlegroup}`;
  const planRange = `'${sheetName}'!FB3:FF52`;
  const prefightRange = `'${sheetName}'!GD3:GF52`;

  const assignments = await sheetsService.readSheet(
    config.MCOC_SHEET_ID,
    planRange
  );
  const prefights = await sheetsService.readSheet(
    config.MCOC_SHEET_ID,
    prefightRange
  );

  return { assignments, prefights };
}
