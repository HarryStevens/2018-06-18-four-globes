const d3 = Object.assign({},
  require("d3-selection"),
  require("d3-geo"),
  require("d3-queue"),
  require("d3-request"),
  require("d3-inertia"),
  require("d3-timer"),
  require("d3-scale")
),
     topojson = require("topojson");

class spinnyGlobe {

  constructor(options) {

    var rotation = [120, 90, 0];
    var projection = d3.geoOrthographic().rotate(rotation);
    var path = d3.geoPath(projection);
    var arr = [];
    var thresholds = [-4.1, -4, -2, -1, -.5, -.2, .2, .5, 1, 2, 4, 4.1],
      colors = ["#0868ac", "#43a2ca", "#7bccc4", "#bae4bc", "#f0f9e8", "#ffffff", "#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026", "#ccc"];

    var color = d3.scaleLinear()
      .domain(thresholds)
      .range(colors);

    var q = d3.queue()
      .defer(d3.json, options.vector)
      .defer(d3.json, options.contours)
      .await(jsonLoaded);

    function jsonLoaded(error, map, contours){
      var feature = topojson.feature(map, map.objects.countries),
          mesh = topojson.feature(map, map.objects.land);

      contours = contours.filter((d, i) => i > 9)

      options.contours = contours;

      // console.log(JSON.stringify(contours.filter((d, i) => i > 9)));
      options.contours.forEach(obj => {
        obj.element = d3.select(".globe-" + obj.id)
        obj.svg = obj.element.append("svg").attr("class", "svg-" + obj.id);
        obj.circle = obj.svg.append("path").attr("class", "sphere").datum({type: "Sphere"});
        return obj;
      })

      resize();

      options.contours.forEach(ready);


      function ready(obj) {
        // // General update pattern for SVG elements.
        obj.contours = obj.svg.selectAll(".contour")
            .data(obj.data, d => d.value)
          .enter().append("path")
            .style("fill", d => color(d.value))
            .attr("class", "contour")
            .attr("d", path)

        obj.countries = obj.svg.selectAll(".country")
            .data(feature.features)
          .enter().append("path")
            .attr("class", "country")
            .attr("d", path);

        obj.boundaries = obj.svg.selectAll(".boundary")
            .data([mesh])
          .enter().append("path")
            .attr("class", "boundary")
            .attr("d", path);
      }

      window.onresize = () => resize();

      function resize() {
        var w = Math.min(+keepNumber(options.contours[0].element.style("width")), 400), h = window.innerHeight;
        var width = Math.min(w * .9, h),
            height = width;

        projection
          .scale(width / 2)
          .clipAngle(90)
          .translate([width / 1.8, height / 2])
          .precision(.5);

        d3.selectAll("svg").attr("width", w).attr("height", height);
        d3.selectAll("path").attr("d", path);
      }   

      var speed = .5;
      var timer = d3.timer(() => {
        redraw();
      });

      var inertia = d3.geoInertiaDrag(d3.selectAll("svg"), () => redraw(true), projection);

      function redraw(clicked){
        if (clicked) timer.stop();

        var r = clicked ? projection.rotate() : rotation.map((d, i) => i !== 2 ? i === 1 && d <= 0 ? 0 : d -= speed : d);
        rotation = r;
        projection.rotate(rotation);

        d3.selectAll("path").attr("d", path);
      }
    
    } // end jsonLoaded()

  }
}

function keepNumber(x){
  return x.replace(/[^\d.-]/g, "");
}

module.exports = spinnyGlobe;
