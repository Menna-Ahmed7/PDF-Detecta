const path = require('path')
const fs = require("fs");
let parser = require("./pdf-parser");
let parsedPdf = "";
let FilesWithPatterns = {};

let NotPDFFile = [];
let countFiles = 1;
let fileCount = 0;
const patternScanners = [
  { func: checkXref, name: "Wrong X reference" },
  { func: exportDataObject, name: "Exec JS (exportDataObject)" },
  { func: Hex_String_Pattern, name: "Embedded Hex String" },
  { func: PdfCommentwithjscode, name: "JS Code (PDF Comment)" },
  { func: PDF_creation_Pattern_2, name: "Embedded PDF-Creation" },
  { func: muilipte_PDF_comments_Pattern, name: "Excessive PDF Comments" },
  { func: streamMalware, name: "Malicious Exec Code (streamMalware)" },
  { func: appv, name: "Malicious JS (app.doc)" },
  { func: cmdandlaunch, name: "Embedded Shell (cmd or launch)" },
  { func: PDF_creation_Pattern, name: "Embedded PDF-Creation" },
  { func: syncAnnotScan_Pattern, name: "Exec JS (syncAnnotScan)" },
  { func: uriv, name: "Malicious URLs" }
];
let PatternCounts = {}
function streamMalware(parsedPdf) {
  const malwarePatterns = /(replace|eval|annot|unescape)\(.*\);/i;

  for (let key in parsedPdf) {
    if (key === "Pdf_comments" || key === "startxref" || key === "xRef")
      break;


    const o = parsedPdf[key];
    const typ = o["Type"];
    const S = o["S"];

    if (typ === "Action" && S === "JavaScript") {
      let tempobj = o;
      let cnt = 100
      while (tempobj && tempobj["References"] && tempobj["References"].length !== 0 && cnt) {
        tempobj = parsedPdf[o.JS ? o.JS[0] : o['#4AS'][0]];
        cnt--
      }
      if (!cnt || !tempobj) return true;
      if (tempobj["Filter"] === "FlateDecode") {
        const streamstr = tempobj["stream"];

        if (malwarePatterns.test(streamstr)) {
          return true;
        }
      }
    }
  }

  return false;
}
function exportDataObject(parsedPdf) {
  for (let key in parsedPdf) {
    const obj = parsedPdf[key]
    if (key === "Pdf_comments" || key === "startxref" || key === "xRef")
      break;
    const typ = obj["Type"];
    const re2 = /exportDataObject\(\{/;

    if (obj["JS"] !== undefined && re2.test(obj["JS"])) {
      return typ === "Action";
    }
  }
  return false;
}
function cmdandlaunch(parsedPdf) {
  for (let key in parsedPdf) {
    const obj = parsedPdf[key]
    if (key === "Pdf_comments" || key === "startxref" || key === "xRef")
      break;
    const typ = obj["Type"];
    const S = obj["S"];

    if (typ === "Action" && S === "Launch") {
      return true;
    }

    if (typ === "Action" && obj["Win"] !== undefined && /.*cmd.exe.*/.test(obj["Win"])) {
      return true;
    }
  }
  return false;
}
function PdfCommentwithjscode(parsedPdf) {
  const regexPatterns = [
    /[\s\w+\n]*function\s+\w+\n*\(.*\)\n*\{.*\}.*/i,
    /[\s\w\n+\n]*\([\s\w+]*\);[\s\w+\n]*/i,
    /[\s\w\n+\n]*let\s+\w+=[\s\w+\n]*;/,
    /[\s\w\n+\n]*var\s+\w+=[\s\w+\n]*;/,
    /[\s\w+\n]*const\s+\w+=[\s\w+\n]*;/,
  ];
  for (const comment of parsedPdf["Pdf_comments"])
    for (const regexPattern of regexPatterns)
      if (regexPattern.test(comment))
        return true;

  return false;

}
function Hex_String_Pattern(parsedPdf) {
  if (parsedPdf['error']) return false;
  for (let id in parsedPdf) {
    let obj = parsedPdf[id]
    for (let key in obj) {
      if (key == "JS") {
        let regex = /<(?:([a-fA-F0-9]{2})+)*>/g;

        if (typeof obj[key] == "string" && obj[key].match(regex)) {
          return true;
        }
      }
    }
  }
  return false;
}
function syncAnnotScan_Pattern(parsedPdf) {
  for (let id in parsedPdf) {
    if (id === "Trailer" || id === "Pdf_comments") {
      break;
    }
    let obj = parsedPdf[id];
    if (obj.Type && JSON.stringify(obj.Type).match(/Action/gi)) {
      for (let key in obj) {
        if (key === "JS" && parsedPdf[obj[key][0]]) {
          if (parsedPdf[obj[key][0]].stream.match(/syncAnnotScan\s*\(\s*\)/g)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}
function PDF_creation_Pattern_2(parsedPdf) {
  for (const comment of parsedPdf["Pdf_comments"]) {
    const pdfPattern = /%PDF/gi;
    if (comment.match(pdfPattern) > 1) return true;
  }
  return false;
}
function PDF_creation_Pattern(parsedPdf) {
  const pdfPattern = /%PDF/gi;
  for (let key in parsedPdf) {
    if (key === "Trailer" || key === "Pdf_comments") break;
    const obj = parsedPdf[key];
    for (let key in obj) {
      if (key === "stream" && obj[key].match(pdfPattern)) {
        return true;
      }
    }
  }
  return false;
}

function muilipte_PDF_comments_Pattern(parsedPdf) {
  try {
    if (parsedPdf["Pdf_comments"].length > 300) {
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
}
function appv(parsedPdf) {
  for (let key in parsedPdf) {
    if (key === "Trailer" || key === "Pdf_comments") break;
    const obj = parsedPdf[key];
    let ref;
    if (obj && obj.S === "JavaScript" && obj.Type === "Action") {
      const refarr = obj.References;
      for (let j in refarr) {
        ref = refarr[j][0];
        if (parsedPdf[ref] && parsedPdf[ref].stream) {
          const stream = parsedPdf[ref].stream;
          let regex = /app(.*?)replace(.*?)|getAnnots|app.doc|app.plugIns/;
          const res = stream.match(regex);
          if (res && res[0]) {
            return true;
          }
        }
      }
    }
  }
  return false;
}
function uriv(parsedPdf) {
  const regex = /http:(.*?)<script/;
  for (let key in parsedPdf) {
    if (key === "Trailer" || key === "Pdf_comments") break;
    const obj = parsedPdf[key];
    if (obj && obj.stream) {
      const stream = obj.stream;
      const res = stream.match(regex);
      if (res != null && res[0] != "") {
        return true;
      }
    }
  }
  return false;
}
function checkXref(parsedPdf) {
  return !parsedPdf["xRef"] && !parsedPdf["startxref"];
}

function FindingFiles(Directory, reportWindow) {
  let stats = fs.statSync(Directory);
  if (stats.isFile())
    FileScanner(Directory, reportWindow);
  else if (stats.isDirectory()) {
    const files = fs.readdirSync(Directory);
    files.forEach((file) => {
      let filePath = path.join(Directory, file);
      let fileStats = fs.statSync(filePath);
      if (fileStats.isDirectory())
        FindingFiles(filePath, reportWindow);
      else
        FileScanner(filePath, reportWindow);
    });
  }
}

function main(Directory, reportWindow) {
  resetValues()
  countFiles = countFilesInFolder(Directory)
  const startTime = new Date();
  FindingFiles(Directory, reportWindow);
  const endTime = new Date();
  let time = endTime.getTime() - startTime.getTime();

  let MalwaresObj = removeZeroValues(PatternCounts)
  PatternCounts = MalwaresObj.result
  let total = MalwaresObj.total
  let statobj =
  {
    malnum: Object.keys(FilesWithPatterns).length,
    total: countFiles,
    time: time,
    paths: FilesWithPatterns,
    pieChart: { labels: Object.keys(PatternCounts), data: Object.values(PatternCounts).map((value) => ((value / total) * 100).toFixed(1)) }
  }

  return statobj
}
let counter = 0

function FileScanner(file, reportWindow) {
  parsedPdf = parser(file);
  const filePattens = new Set();
  if (parsedPdf["error"]) {
    PatternCounts['not a pdf']++;
    NotPDFFile.push(file);
    FilesWithPatterns[file] = [parsedPdf["error"]]
    return;
  }
  counter++;
  reportWindow.webContents.send('Progress', { counter: counter, total: countFiles })

  patternScanners.forEach(({ func, name }) => {
    if (func(parsedPdf)) {
      filePattens.add(name);
      PatternCounts[name]++;
    }
  });

  if (filePattens.size !== 0) {
    FilesWithPatterns[file] = filePattens 
    reportWindow.webContents.send('table', { path: file })
  }
}

function CheckPdf(filePath) {
  const bytesToRead = 4; // Read the first 4 bytes
  const buffer = Buffer.alloc(bytesToRead);

  try {
    fs.readSync(fs.openSync(filePath, "r"), buffer, 0, bytesToRead, 0);
    const magicNumber = buffer.readUInt32BE(0);
    return magicNumber === 0x25504446;
  } catch (error) {
    return false; // Handle errors, such as file not found
  }
}
function countFilesInFolder(folderPath) {
  const stack = [folderPath];
  let fileCount = 0;
  while (stack.length > 0) {
    const currentPath = stack.pop();
    const stats = fs.statSync(currentPath);

    if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      for (const file of files) {
        const filePath = path.join(currentPath, file);
        const fileStats = fs.statSync(filePath);
        if (fileStats.isFile() && CheckPdf(filePath)) {
          fileCount++;
        } else if (fileStats.isDirectory()) {
          stack.push(filePath);
        }
      }
    } else if (stats.isFile() && CheckPdf(currentPath)) {
      fileCount++;
    }
  }
  return fileCount;
}
function removeZeroValues(obj) {
  const result = {};
  let total = 0
  for (const key in obj) {
    if (obj[key] !== 0) {
      result[key] = obj[key];
    }
    total += obj[key]
  }

  return { result: result, total: total };
}
function resetValues(){
  fileCount = 0;
  counter = 0
  FilesWithPatterns = {}
  for (const { name } of patternScanners) {
    PatternCounts[name] = 0;
  }
  PatternCounts['not a pdf'] = 0 
}
module.exports = main;

