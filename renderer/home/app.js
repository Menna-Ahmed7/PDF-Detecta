const scanFolderButton = document.getElementById('scanFolderButton');
const scanFilesButton = document.getElementById('scanFilesButton');
const folderInput = document.getElementById('folderInput');
const fileInput = document.getElementById('fileInput');

// Add click event listeners to the buttons
scanFolderButton.addEventListener('click', () => {
  // Trigger the click event on the folder input element

electron.openDialog()
    .then(result =>{ 
      if(result){
      ipcRenderer.send('open report',{type:'folder',path:result})
      }
    });
  //folderInput.click();
});

scanFilesButton.addEventListener('click', () => {
  // Trigger the click event on the file input element
  fileInput.click();
});

// Add an event listener to the folder input element to handle folder selection
fileInput.addEventListener('change', (event) => {
  const selectedFile = event.target.files[0]; // Access the selected folder
  if (selectedFile) {
    console.log(selectedFile.path)
    ipcRenderer.send('open report',{type:'file',path:selectedFile.path})
    fileInput.value=''
   }
});

