const fs = require("fs");

const zlib = require("zlib");
function flateDecode(stream) {
  const s = stream.trimStart();
  try {
    const decompressedBuffer = zlib.inflateSync(Buffer.from(s, "binary"));
    const decodedText = decompressedBuffer.toString("utf-8");
    return decodedText;
  } catch (error) {
    return s;
  }
}

function getObjectsFromPDFV2(pdfObjectsString) {
  const objregex = /(\d+\s)(\d+\s)obj/g;
  const endobjregex = /endobj/g;

  const ObjMatchArr = pdfObjectsString.match(objregex);
  const EndObjMatchArr = pdfObjectsString.match(endobjregex);

  const regexContent = /obj[\s\S]+?endobj/gs;
  const regexID = /endobj[\s\S]+?obj/gs;

  const objectsIDs = pdfObjectsString.match(regexID);
  const objectsContents = pdfObjectsString.match(regexContent);

  if (
    EndObjMatchArr &&
    ObjMatchArr &&
    (EndObjMatchArr.length - objectsContents.length > 10 ||
      ObjMatchArr.length - objectsContents.length) > 10
  )
    return { error: "parsing error,endobj mismatch" };

  const objArray = [];
  setFirstObject(objArray, pdfObjectsString);
  // look here you to know will u return not a pdf or mw
  if (!objectsIDs) {
    return [];
  }
  for (let i = 0; i < objectsIDs.length; i++) {
    const objectString = (objectsIDs[i] + objectsContents[i + 1]).replace(
      /(end)?obj/g,
      ""
    );
    objArray.push(objectString);
  }
  return objArray;
}
function setFirstObject(objArray, pdfObjectsString) {
  const regex = /(\d+)\s+\d+\s+obj\s+(.*?)\s+endobj/gs;
  if (pdfObjectsString.match(regex))
    objArray.push(pdfObjectsString.match(regex)[0].replace(/(end)?obj/g, ""));
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

let remaining = [];
let allRefs = [];

function parsing(pdfObjects) {
  let obj_ds = {};
  pdfObjects.forEach((object) => {
    const regexID = /\d+\s/;

    let id = object.match(regexID) ? object.match(regexID)[0].trim() : "0";
    obj_ds[id] = {};
    const regexObj = /<<(.*)>>/s;
    let objectContent = object.match(regexObj);
    if (!objectContent) return;

    obj_ds[id] = {
      ...{ id: id },
      ...createParts(
        objectContent[0]
          .replaceAll("\r\n", "")
          .replace(/stream[\s\S]*$/, "")
          .trim()
      ),
    };
    const regexStream = /stream.*endstream/gs;
    let objectStream = object.match(regexStream);
    if (objectStream) {
      obj_ds[id]["stream"] = flateDecode(
        objectStream[0].replace(/(end)?stream/g, "")
      );
    }
  });
  return obj_ds;
}
function createParts(objectContent) {
  let o = parseObj(objectContent);
  while (remaining.length > 0) {
    modifyValueByKey(
      o,
      remaining[0],
      parseObj(findValueByKey(o, remaining[0]))
    );
    remaining.shift();
  }
  o["References"] = allRefs;
  allRefs = [];
  return o;
}
function parseObj(str) {
  str = String(str);
  let cleanedString = str
    .substring(3, str.length - 2)
    .replaceAll("\n", "")
    .replace(/ +(?=\/|<<|>>|\[)/g, "")
    .replace(/(?<=\/)(\w+)\(([^)]+)\)/g, "$1/($2)");
  let t = cleanedString.match(/<<([^<>]*(?:<<[^<>]*>>[^<>]*)*)>>/gs);
  let urls = cleanedString.match(/\([^)]*(?![^\s]*\])[^)]*\)/g);
  let counter = 0;
  let counterUrl = 0;
  if (t) {
    t.forEach((e) => {
      cleanedString = cleanedString.replace(e, "/<lol>");
    });
  }
  if (urls) {
    urls.forEach((e) => {
      cleanedString = cleanedString.replace(e, "/<url>");
    });
  }
  let parts = cleanedString.split("/").filter((e) => e != "");

  let obj = {};
  let references = [];
  for (let i = 0; i < parts.length; i += 2) {
    let key = parts[i] ? parts[i].trim() : parts[i];
    let value = parts[i + 1] ? parts[i + 1].trim() : parts[i + 1];

    let sqbracket = key.match(/\w*\[.*]/g);
    let tArrMatch = key.match(/(\w+ (?:\d+ )*\d+(?: R)?)/g);
    if (sqbracket) {
      indexOfBracket = sqbracket[0].indexOf("[");
      key = sqbracket[0].substring(0, indexOfBracket);
      value = sqbracket[0]
        .substring(indexOfBracket + 1, sqbracket[0].length - 1)
        .trimStart()
        .split(" ");
      i--;
    } else if (tArrMatch) {
      let keyVals = key.split(" ");
      key = keyVals[0];
      value = keyVals.slice(1);
      if (value.includes("R")) {
        references.push(value);
        allRefs.push(value);
      }
      i--;
    } else if (key.includes(" ")) {
      let keyVals = key.split(/\s(.+)/, 2);
      key = keyVals[0];
      value = keyVals[1];
      //i--; why this was the problem
    }
    if (value == "<lol>") {
      remaining.push(key);
      value = t[counter];
      counter++;
    }
    if (value && value.includes("<url>")) {
      value = value.replace("<url>", urls[counterUrl]);
      counterUrl++;
    }
    if (key[key.length - 1] == "]") {
      value = "";
      i--;
    }

    obj[key] = value;
  }

  obj["References"] = references;
  return obj;
}

function modifyValueByKey(obj, key, newValue) {
  // Check if the current object has the key
  if (obj.hasOwnProperty(key)) {
    obj[key] = newValue; // Modify the key's value
    return true; // Key found and modified in the current object
  }

  // Iterate through the object's properties
  for (let prop in obj) {
    if (obj.hasOwnProperty(prop) && typeof obj[prop] === "object") {
      // If the property is an object, recursively search and modify within it
      const result = modifyValueByKey(obj[prop], key, newValue);
      if (result) {
        return true; // Key found and modified in a nested object
      }
    }
  }

  // Key not found
  return false;
}
function findValueByKey(obj, key) {
  // Check if the current object has the key
  if (obj.hasOwnProperty(key)) {
    return obj[key]; // Key found in the current object
  }

  // Iterate through the object's properties
  for (let prop in obj) {
    if (obj.hasOwnProperty(prop) && typeof obj[prop] === "object") {
      // If the property is an object, recursively search within it
      const result = findValueByKey(obj[prop], key);
      if (result !== undefined) {
        return result; // Key found in a nested object
      }
    }
  }

  // Key not found
  return undefined;
}
function parseTrailer(obj_ds, pdfObjectsString) {
  const regexTrailer = /trailer(.*?)startxref/gs;
  let trailerMatch = pdfObjectsString.match(regexTrailer);
  if (!trailerMatch) return;
  let trailerObj = trailerMatch[0]
    .replace("trailer", "")
    .replace("startxref", "")
    .trim();
  obj_ds["Trailer"] = createParts(trailerObj);
}
function PdfComment(obj_ds, pdfObjectsString) {
  let regex = /(\d+)\s+\d+\s+obj\s*(.*?)\s+endobj/gs;
  let editablepdfstr = deletepart(regex, pdfObjectsString);

  const regexXref = /^xref(.*?)(?=trailer)/gms;
  editablepdfstr = deletepart(regexXref, editablepdfstr);

  const regexTrailer = /trailer(.*?)(?=startxref)/gs;
  editablepdfstr = deletepart(regexTrailer, editablepdfstr);

  const regexStref = /(?<=startxref[\r\n]+)\d+/gs;
  let startxrefArr = editablepdfstr.match(regexStref);

  editablepdfstr = deletepart(regexStref, editablepdfstr);
  editablepdfstr = editablepdfstr.replace("startxref", "");
  CommentsArr = editablepdfstr.split("\r\n").filter((e) => {
    return e != "";
  });
  obj_ds["Pdf_comments"] = CommentsArr;
  obj_ds["startxref"] = startxrefArr;
  obj_ds["xRef"] = !!pdfObjectsString.match(regexXref);
}
function deletepart(regex, pdfstr) {
  let matcharr = pdfstr.match(regex);
  if (matcharr) {
    matcharr.forEach((match) => {
      pdfstr = pdfstr.replace(match, "");
    });
  }

  return pdfstr;
}
function finalParse(pdfPath = process.argv.slice(2)[0] || "k.pdf") {
  
  if (!CheckPdf(pdfPath)) return { error: "not a pdf" };
  const pdfObjectsString = fs.readFileSync(pdfPath, "binary");
  let pdfObjects = getObjectsFromPDFV2(pdfObjectsString);
  if (pdfObjects.error) return { error: pdfObjects };

  let obj_datastr = parsing(pdfObjects);

  parseTrailer(obj_datastr, pdfObjectsString);
  PdfComment(obj_datastr, pdfObjectsString);
  fs.closeSync(fs.openSync(pdfPath, 'r'))
  return obj_datastr;
}
module.exports = finalParse;