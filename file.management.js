import fs from 'fs';

export function writeFileToLocal(data) {
    let fileData = [];
    const filePath = 'data.json';

    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        try {
            const parsed = JSON.parse(fileContent);
            fileData = Array.isArray(parsed) ? parsed : []; // ✅ ensure it's an array
        } catch (err) {
            console.error('Invalid JSON, resetting file.');
            fileData = [];
        }
    }
    if (data?.id) {
        const index = fileData.findIndex(user => user.id === data.id);

        if (index !== -1) {
            // Update only the fields that are provided (non-undefined)
            fileData[index] = {
                ...fileData[index],
                ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined)),
            };
        } else {
            // If no id provided or not found, create new entry with auto ID
            const newId = data.id || (fileData.length > 0 ? Math.max(...fileData.map(u => u.id || 0)) + 1 : 1);
            fileData.push({ id: newId, ...data });
        }

    } else {
        // ✅ Insert new with auto-generated ID
        const newId = fileData.length > 0 ? Math.max(...fileData.map(u => u.id)) + 1 : 1;
        fileData.push({ id: newId, ...data });
    }

    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf-8');

    return data;
}



export function readFileFromLocal() {
    const filePath = 'data.json';
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
}