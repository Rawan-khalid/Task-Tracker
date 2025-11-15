import { Project, Task, Document, FollowUp } from "../types";

// These should be stored in environment variables, but for this context, we'll use placeholders.
// You must create your own credentials in Google Cloud Console for this to work.
const API_KEY = process.env.GOOGLE_API_KEY || 'YOUR_API_KEY';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

const PROJECT_HEADERS = ['id', 'name', 'parentId', 'status', 'createdAt'];
const TASK_HEADERS = ['id', 'title', 'details', 'projectId', 'status', 'createdAt', 'closedAt', 'documents', 'followUps', 'order', 'isPriority'];
const COMPLEX_TASK_FIELDS: (keyof Task)[] = ['documents', 'followUps', 'isPriority'];


declare global {
    interface Window {
        gapi: any;
        google: any;
        tokenClient: any;
    }
}

// FIX: This function was refactored to correctly handle default values for different data types
// and to resolve a TypeScript error by explicitly typing `value` as `any`.
const rowToObject = <T extends { [key: string]: any }>(row: any[], headers: string[], complexFields: (keyof T)[] = []): T => {
    const obj: any = {};
    headers.forEach((header, index) => {
        const key = header as keyof T;
        let value: any = row[index];

        if (complexFields.includes(key) && typeof value === 'string') {
            try {
                value = JSON.parse(value);
            } catch {
                if (key === 'documents' || key === 'followUps') value = [];
                if (key === 'isPriority') value = false;
            }
        } else if (key === 'order') {
            value = Number(value || 0);
        } else if (value === undefined || value === null) {
            if (key === 'documents' || key === 'followUps') {
                value = [];
            } else if (key === 'isPriority') {
                value = false;
            } else {
                value = '';
            }
        }
        obj[key] = value;
    });
    return obj as T;
};

const objectToRow = <T extends { [key: string]: any }>(obj: T, headers: string[], complexFields: (keyof T)[] = []): any[] => {
    return headers.map(header => {
        const key = header as keyof T;
        let value = obj[key];
        if (complexFields.includes(key)) {
            value = JSON.stringify(value);
        }
        return value !== undefined && value !== null ? value : '';
    });
};

const gapiLoadPromise = new Promise<void>((resolve) => {
    const checkGapi = () => {
        if (window.gapi && window.gapi.client) {
            resolve();
        } else {
            setTimeout(checkGapi, 100);
        }
    };
    checkGapi();
});

const gisLoadPromise = new Promise<void>((resolve) => {
    const checkGis = () => {
        if (window.google && window.google.accounts) {
            resolve();
        } else {
            setTimeout(checkGis, 100);
        }
    };
    checkGis();
});


export const googleSheetsService = {
    _spreadsheetId: null as string | null,
    _sheetInfo: null as any | null,
    
    async initClient(onAuthChange: (isSignedIn: boolean) => void) {
        await gapiLoadPromise;
        await window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
        });

        await gisLoadPromise;
        window.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse: any) => {
                if (tokenResponse && tokenResponse.access_token) {
                    onAuthChange(true);
                }
            },
        });
        
        // A simple check for an existing token
        const token = window.gapi.client.getToken();
        onAuthChange(!!token);
    },

    handleSignIn() {
        if (window.tokenClient) {
            window.tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    },

    handleSignOut() {
        const token = window.gapi.client.getToken();
        if (token !== null) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken('');
            });
        }
    },

    async _ensureSheet(spreadsheetId: string, sheetName: string, headers: string[]) {
        if (!this._sheetInfo || this._sheetInfo.spreadsheetId !== spreadsheetId) {
            const response = await window.gapi.client.sheets.spreadsheets.get({
                spreadsheetId: spreadsheetId,
            });
            this._sheetInfo = response.result;
        }

        const sheetExists = this._sheetInfo.sheets.some((s: any) => s.properties.title === sheetName);

        if (!sheetExists) {
            await window.gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                resource: {
                    requests: [{ addSheet: { properties: { title: sheetName } } }]
                }
            });
            await this.writeData(sheetName, []); // This will write headers
        }
    },
    
    async loadData(spreadsheetId: string) {
        this._spreadsheetId = spreadsheetId;
        this._sheetInfo = null; // reset sheet info cache
        
        await this._ensureSheet(spreadsheetId, 'Projects', PROJECT_HEADERS);
        await this._ensureSheet(spreadsheetId, 'Tasks', TASK_HEADERS);

        const response = await window.gapi.client.sheets.spreadsheets.values.batchGet({
            spreadsheetId: spreadsheetId,
            ranges: ['Projects!A2:Z', 'Tasks!A2:Z'],
        });

        const projectsData = response.result.valueRanges[0]?.values || [];
        const tasksData = response.result.valueRanges[1]?.values || [];
        
        const projects: Project[] = projectsData.map((row: any[]) => rowToObject<Project>(row, PROJECT_HEADERS));
        const tasks: Task[] = tasksData.map((row: any[]) => rowToObject<Task>(row, TASK_HEADERS, COMPLEX_TASK_FIELDS));

        return { projects, tasks };
    },

    async writeData<T extends {id: string}>(sheetName: 'Projects' | 'Tasks', data: T[]) {
        if (!this._spreadsheetId) throw new Error("Spreadsheet ID not set.");
        const headers = sheetName === 'Projects' ? PROJECT_HEADERS : TASK_HEADERS;
        const complexFields = sheetName === 'Tasks' ? COMPLEX_TASK_FIELDS : [];

        // FIX: Cast `complexFields` to `(keyof T)[]` to match the generic type expected by `objectToRow`.
        const values = [headers, ...data.map(item => objectToRow(item, headers, complexFields as (keyof T)[]))];
        
        await window.gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId: this._spreadsheetId,
            range: `${sheetName}!A1:Z`,
        });

        return window.gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: this._spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values },
        });
    },

    async appendRow<T extends {id: string}>(sheetName: 'Projects' | 'Tasks', item: T) {
        if (!this._spreadsheetId) throw new Error("Spreadsheet ID not set.");
        const headers = sheetName === 'Projects' ? PROJECT_HEADERS : TASK_HEADERS;
        const complexFields = sheetName === 'Tasks' ? COMPLEX_TASK_FIELDS : [];
        // FIX: Cast `complexFields` to `(keyof T)[]` to match the generic type expected by `objectToRow`.
        const values = [objectToRow(item, headers, complexFields as (keyof T)[])];

        return window.gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: this._spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values },
        });
    },

    async updateRow<T extends {id: string}>(sheetName: 'Projects' | 'Tasks', id: string, item: T) {
        if (!this._spreadsheetId) throw new Error("Spreadsheet ID not set.");
        const headers = sheetName === 'Projects' ? PROJECT_HEADERS : TASK_HEADERS;
        const complexFields = sheetName === 'Tasks' ? COMPLEX_TASK_FIELDS : [];
        
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: this._spreadsheetId,
            range: `${sheetName}!A2:Z`,
        });
        
        const rows = response.result.values || [];
        const rowIndex = rows.findIndex((row: any[]) => row[0] === id);

        if (rowIndex === -1) {
            throw new Error("Row not found for update.");
        }

        const range = `${sheetName}!A${rowIndex + 2}`;
        // FIX: Cast `complexFields` to `(keyof T)[]` to match the generic type expected by `objectToRow`.
        const values = [objectToRow(item, headers, complexFields as (keyof T)[])];

        return window.gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: this._spreadsheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values },
        });
    },
    
    async deleteRow(sheetName: 'Projects' | 'Tasks', id: string) {
        if (!this._spreadsheetId) throw new Error("Spreadsheet ID not set.");
        
        if (!this._sheetInfo || this._sheetInfo.spreadsheetId !== this._spreadsheetId) {
            const response = await window.gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this._spreadsheetId,
            });
            this._sheetInfo = response.result;
        }

        const sheet = this._sheetInfo.sheets.find((s: any) => s.properties.title === sheetName);
        if(!sheet) throw new Error(`Sheet ${sheetName} not found.`);
        const sheetId = sheet.properties.sheetId;

        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: this._spreadsheetId,
            range: `${sheetName}!A2:Z`,
        });
        
        const rows = response.result.values || [];
        const rowIndex = rows.findIndex((row: any[]) => row[0] === id);

        if (rowIndex === -1) {
            console.warn("Row not found for deletion, it might have been already deleted.");
            return;
        }

        return window.gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this._spreadsheetId,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex + 1, // +1 because it's 0-indexed and after header
                            endIndex: rowIndex + 2
                        }
                    }
                }]
            }
        });
    }
};