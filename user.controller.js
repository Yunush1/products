import { readFileFromLocal, writeFileToLocal } from "./file.management.js"


function loginUser(req) {
    const { username } = req
    const data = readFileFromLocal()
    let user = data.filter(user => user.username === username)
    return { message: "login user", user}
}
function addUser(req) {
    const { id, name, username, isBlocked, role, permissions } = req
    const user = { id,name, username, isBlocked, role, permissions }
   return writeFileToLocal(user)
}

export { loginUser, addUser }
