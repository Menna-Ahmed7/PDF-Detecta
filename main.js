const { app, BrowserWindow, Menu, ipcMain ,dialog } = require('electron');
const path = require('path')
const { exec } = require('child_process');

const isMac = process.platform === 'darwin';
const stat  = require('./scan_antiVirus.js');

let startWindow;
let reportWindow;

function createStartWindow() {
  
  startWindow = new BrowserWindow({
    title: 'Log in Page',
    width: 1000,
    height: 800,
    
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Add this line
      nodeIntegration: true
    },
  });
  //startWindow.webContents.openDevTools();

  startWindow.loadFile(path.join(__dirname, './renderer/home/index.html'));
}
//let data={name:"nancy",age:20};
function createReportWindow() {
  reportWindow = new BrowserWindow({
    title: 'Report Page',
    width: 1000,
    height: 800,
    webPreferences:{
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Add this line
      nodeIntegration:true,
    }
  });
  //reportWindow.webContents.send("data",data);
  reportWindow.loadFile(path.join(__dirname, './renderer/result/report.html'));
}

app.whenReady().then(() => {
  createStartWindow();

  const mainMenu = Menu.buildFromTemplate(menu);
  Menu.setApplicationMenu(mainMenu);
  ipcMain.handle('dialog',  async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(startWindow, {
      properties: ['openDirectory']
    })
    if (canceled) {
      return
    } else {
      return filePaths[0]
    }
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createStartWindow();
    }
  });
});
ipcMain.on('open report', (event,data) => {
 
  let {path,type} = data

    createReportWindow(); 
    
  reportWindow.once('ready-to-show', () => {
    let statobj = stat(path,reportWindow)
    reportWindow.webContents.send('statistics',statobj)
    reportWindow.webContents.openDevTools()

  })
});

const menu = [
  {
    role: 'quit',
    label:'quit',
    click: () => {
      app.quit();
    },
    accelerator: 'CmdOrCtrl+q',
  },
    {
    label: 'exit',
    click: () => {
      reportWindow?.close();
    },
    accelerator: 'CmdOrCtrl+e',
  },
];

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Open aLoginwindo if none are open (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createStartWindow();
});



process.on('uncaughtException', function (err) {
  console.log(err);
})
function Delete_ALL(filesPaths) {

  for (let filepath of filesPaths) {
    Delete_FILE(filepath)
  }
}
function Delete_FILE(path) {//delet onee file custom choice
  exec(`del "${path}"`, (error, stdout, stderr) => {
    if (error) {
      return;
    }
  });
}
ipcMain.on('delete', (event,data) => {
 Delete_FILE(data.path)
})
ipcMain.on('deleteall', (event,data) => {
  Delete_ALL(data.paths)
 })

