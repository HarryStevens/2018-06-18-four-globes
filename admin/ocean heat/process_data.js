var fs = require("fs"),
    jz = require("jeezy"),
    chroma = require("chroma-js"),
    d3 = require("d3-array");

var file_name = "1988.txt";

processData(file_name);

function processData(file_name){
  var data = fs.readFileSync(file_name, "utf8");
  var out = [];
  data = data
    .replace(new RegExp("-9", "g"), " -9")
    .replace(new RegExp("-8", "g"), " -8")
    .replace(new RegExp("-7", "g"), " -7")
    .replace(new RegExp("-6", "g"), " -6")
    .replace(new RegExp("-5", "g"), " -5")
    .replace(new RegExp("-4", "g"), " -4")
    .replace(new RegExp("-3", "g"), " -3")
    .replace(new RegExp("-2", "g"), " -2")
    .replace(new RegExp("-1", "g"), " -1")
    .replace(new RegExp("-0", "g"), " -0");

  while (data.includes("  ")){
    data = jz.str.replaceAll(data, "  ", " ");
  }
  data = data.split("\n").map(d => d.trim().split(" "));
  data.pop();
  data.forEach(row => {
    row.forEach(cell => {  
      if (isNaN(+cell) || !cell){
        console.log(cell);
      }
      out.push(+cell)
    });
  });

  var nanFiltered = out.filter(d => d !== -99.9999);
  console.log(nanFiltered.length / out.length * 100);
  var extent = d3.extent(nanFiltered);
  console.log(extent);

  var limits = chroma.limits(nanFiltered, "q", 5);

  var lessThanZero = nanFiltered.filter(d => d < 0);

  fs.writeFileSync("data-" + file_name.replace("txt", "json"), JSON.stringify(out));
}
