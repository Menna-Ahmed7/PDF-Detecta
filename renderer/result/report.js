const overlay = document.getElementById('overlay');
const popup = document.getElementById('popup');
const closeButton = document.getElementById('close-button');
const button1 = document.getElementById('button1');
const button2 = document.getElementById('button2');
const table = document.getElementsByClassName("Table")[0];
let malnum=document.getElementById('malnum');
const total=document.getElementById('total')
const time=document.getElementById('time')
const deleteall=document.getElementById('deleteall')
var tableContainer = document.getElementsByClassName("over")[0]; // Replace with your actual container ID

let paths={}
deleteall.addEventListener('click',()=>{
  ipcRenderer.send('deleteall',{paths:Object.keys(paths)})
  for (let key in paths) 
    deleteElement(document.getElementsByClassName(key.replaceAll(" ",""))[0])
})

function deleteElement(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
    malnum.innerText= parseInt(malnum.innerText)-1
  }
}

function openPopup(filepath) {
  overlay.style.display = 'block';
  popup.style.display = 'block';
  let x = document.getElementById('patterns')
  x.innerText = Array.from(paths[filepath]).join('\n')
  button1.addEventListener('click', () => {    
    ipcRenderer.send('delete',{path:filepath})
    deleteElement(document.getElementsByClassName(filepath.replaceAll(" ",""))[0])
   
    closePopup()
  });
  button2.addEventListener('click', () => {
    // Handle button 2 click
    console.log('Button 2 clicked');
    closePopup()
  });
}

function closePopup() {
  overlay.style.display = 'none';
  popup.style.display = 'none';
}

overlay.addEventListener('click', closePopup);
closeButton.addEventListener('click', closePopup);





const progressBar = document.querySelector(".circular-progress");


  const progressValue = progressBar.querySelector(".percentage");
  const innerCircle = progressBar.querySelector(".inner-circle");
  let startValue = 0,
  endValue = Number(progressBar.getAttribute("data-percentage")),
  progressColor = progressBar.getAttribute("data-progress-color");

  const progress = (startValue) => {
    progressValue.textContent = `${startValue}%`;
    progressValue.style.color = `${progressColor}`;

    innerCircle.style.backgroundColor = `${progressBar.getAttribute(
      "data-inner-circle-color"
    )}`;

    progressBar.style.background = `conic-gradient(${progressColor} ${startValue * 3.6
      }deg,${progressBar.getAttribute("data-bg-color")} 0deg)`;
}




 const myChart = document.querySelector(".my-chart");
 const ul = document.querySelector(".programming-stats .details ul");


const populateUl = (chartData) => {
  chartData.labels.forEach((l, i) => {
    let li = document.createElement("li");
    li.innerHTML = `${l}: <span class='percentage'>${chartData.data[i]}%</span>`;
    ul.appendChild(li);
  });
};

function changeUI() {
  let heading = document.getElementsByClassName("mal-heading")[0];
  heading.textContent = "Dangerous Files";
  heading.style.border = "solid #c61345 2px";
  heading.style.background = "#653d49";
  let mal = document.getElementsByClassName("mal")[0];
  mal.style.border="solid #c61345 4px";
  mal.style.background="#653d49";
  let thead = document.getElementsByClassName("safeThead")[0];
  thead.style.display="contents";
  let img=document.getElementsByClassName("table-img")[0];
  img.style.display="none";
}


function malfile(filepath) {
 
  // Create the table row
  const filename = path.basename(filepath);
  var row = document.createElement("tr");

  // Create the table data (columns)
  var column1 = document.createElement("td");
  column1.textContent = filename;

  var column2 = document.createElement("td");
  column2.textContent = filepath;

  var column3 = document.createElement("td");
  var button = document.createElement("button");
  row.className=filepath.replaceAll(" ","")
  button.className = "mal-btn";
  button.textContent = "Take action";
  // Append the button to the third column
  button.addEventListener('click',()=>openPopup(filepath))
  column3.appendChild(button);

  // Append the columns to the row
  row.appendChild(column1);
  row.appendChild(column2);
  row.appendChild(column3);
  table.appendChild(row);
  tableContainer.scrollTop = tableContainer.scrollHeight;
}
window.electronAPI.onUpdateTable((_event, value) => {
  changeUI()
  malfile(value.path);
});
window.electronAPI.Progress((_event, value) => {
  let per = Math.ceil(((value.counter /value.total)* 100));
  if (per == 100) {
    let status = document.getElementsByClassName("status")[0];
    status.textContent = "Completed!!";
    status.style.color = "#67fe9c";
    tableContainer.scrollTop = 0
  }
  progress(per)
})

function stat(statobj)
{
  total.textContent=statobj.total
  malnum.textContent=statobj.malnum
  time.textContent=((statobj.time)/1000).toFixed(1)

  paths=statobj.paths
 
}
window.electronAPI.statistics((_event, value) => {
  stat(value)
  let chartData = value.pieChart
  new Chart(myChart, {
    type: "doughnut",
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: "Language Popularity",
          data: chartData.data,
          backgroundColor:["#c61345", "#279DD7", "#F94C10", '#F8DE22', "#262728", "#7abdff", "#0056b3", "#FF5733"]//["#007bff", "#0056b3", "#262728", "#cdcdce", "#7abdff", "#fff", "#F94C10", "#F8DE22", "#c61345", "#279DD7", "#1A6D70", "#E53E3E"]
          ,
        },
      ],
    },
    options: {
      borderWidth: 2,
      borderRadius: 2,
      hoverBorderWidth: 0,
      plugins: {
        legend: {
          display: false,
        },
      },
    },
  });
  populateUl(chartData);

})
