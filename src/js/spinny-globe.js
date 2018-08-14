const d3 = Object.assign({},
  require("d3-selection"),
  require("d3-geo"),
  require("d3-fetch"),
  require("d3-inertia"),
  require("d3-timer")
),
     topojson = require("topojson");

class spinnyGlobe {

  constructor(options) {
    var rotation = [130, -45, 0];
    var projection = d3.geoOrthographic().rotate(rotation);
    var path = d3.geoPath(projection);
    var arr = [];

    d3.json(options.vector).then(jsonLoaded);

    function jsonLoaded(map){
      var feature = topojson.feature(map, map.objects.countries),
          mesh = topojson.feature(map, map.objects.land);

      options.globes.forEach(opts => {
        var obj = JSON.parse(JSON.stringify(opts));
        obj.element = opts.element; // The element doesn't get cloned, but it's okay if it's immutable.
        arr.push(obj);

        // SVG map declarations
        obj.svg = d3.select(opts.element).append("svg").attr("class", "svg-" + opts.globeid);
        
        // A sphere to surround the globe.
        obj.circle = obj.svg.append("path").attr("class", "sphere").datum({type: "Sphere"});

        // Select the canvas from the document.
        obj.canvas = d3.select(opts.element).append("canvas").node();

        // Create the WebGL context, with fallback for experimental support.
        obj.context = obj.canvas.getContext("webgl") || obj.canvas.getContext("experimental-webgl");

        // Compile the vertex shader.
        obj.vertexShader = obj.context.createShader(obj.context.VERTEX_SHADER);
        obj.context.shaderSource(obj.vertexShader, document.querySelector("#vertex-shader").textContent);
        obj.context.compileShader(obj.vertexShader);
        if (!obj.context.getShaderParameter(obj.vertexShader, obj.context.COMPILE_STATUS)) throw new Error(obj.context.getShaderInfoLog(obj.vertexShader));

        // Compile the fragment shader.
        obj.fragmentShader = obj.context.createShader(obj.context.FRAGMENT_SHADER);
        obj.context.shaderSource(obj.fragmentShader, document.querySelector("#fragment-shader").textContent);
        obj.context.compileShader(obj.fragmentShader);
        if (!obj.context.getShaderParameter(obj.fragmentShader, obj.context.COMPILE_STATUS)) throw new Error(obj.context.getShaderInfoLog(obj.fragmentShader));

        // Link and use the program.
        obj.program = obj.context.createProgram();
        obj.context.attachShader(obj.program, obj.vertexShader);
        obj.context.attachShader(obj.program, obj.fragmentShader);
        obj.context.linkProgram(obj.program);
        if (!obj.context.getProgramParameter(obj.program, obj.context.LINK_STATUS)) throw new Error(obj.context.getProgramInfoLog(obj.program));
        obj.context.useProgram(obj.program);

        // Define the positions (as vec2) of the square that covers the canvas.
        obj.positionBuffer = obj.context.createBuffer();
        obj.context.bindBuffer(obj.context.ARRAY_BUFFER, obj.positionBuffer);
        obj.context.bufferData(obj.context.ARRAY_BUFFER, new Float32Array([
            -1.0, -1.0,
            +1.0, -1.0,
            +1.0, +1.0,
            -1.0, +1.0
          ]), obj.context.STATIC_DRAW);

        // Bind the position buffer to the position attribute.
        obj.positionAttribute = obj.context.getAttribLocation(obj.program, "a_position");
        obj.context.enableVertexAttribArray(obj.positionAttribute);
        obj.context.vertexAttribPointer(obj.positionAttribute, 2, obj.context.FLOAT, false, 0, 0);

        // Extract the projection parameters.
        obj.translateUniform = obj.context.getUniformLocation(obj.program, "u_translate");
        obj.scaleUniform = obj.context.getUniformLocation(obj.program, "u_scale");
        obj.rotateUniform = obj.context.getUniformLocation(obj.program, "u_rotate");

        // Load the reference image.
        obj.image = new Image;
        obj.image.src = opts.raster;
        obj.image.onload = () => readySoon(obj);

      }); // end loop

      function readySoon(obj){
        setTimeout(() => {
          resize();
          ready(obj);
        }, 10);

        window.addEventListener("resize", resize);
      }

      function ready(obj) {
        // Create a texture and a mipmap for accurate minification.
        obj.texture = obj.context.createTexture();
        obj.context.bindTexture(obj.context.TEXTURE_2D, obj.texture);
        obj.context.texParameteri(obj.context.TEXTURE_2D, obj.context.TEXTURE_MAG_FILTER, obj.context.LINEAR);
        obj.context.texParameteri(obj.context.TEXTURE_2D, obj.context.TEXTURE_MIN_FILTER, obj.context.LINEAR_MIPMAP_LINEAR);
        obj.context.texImage2D(obj.context.TEXTURE_2D, 0, obj.context.RGBA, obj.context.RGBA, obj.context.UNSIGNED_BYTE, obj.image);
        obj.context.generateMipmap(obj.context.TEXTURE_2D);

        obj.context.uniform3fv(obj.rotateUniform, projection.rotate()); // Three-axis rotation
        obj.context.bindTexture(obj.context.TEXTURE_2D, obj.texture); // XXX Safari
        obj.context.drawArrays(obj.context.TRIANGLE_FAN, 0, 4);

        // General update pattern for SVG elements.
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

      function resize() {
        var container_width = +keepNumber(d3.select(".globe-container").style("width"));
        var container_height = +keepNumber(d3.select(".globe-container").style("height"));
        var container_top = d3.select(".globe-container").node().getBoundingClientRect().top;
        var container_left = d3.select(".globe-container").node().getBoundingClientRect().left || d3.select(".globe-container").node().getBoundingClientRect().x;

        var w = Math.min(+keepNumber(d3.select(options.globes[0].element).style("width")), 500), h = window.innerHeight;
        var width = Math.min(w * (window.innerWidth < 400 ? .9 : .9), h),
            height = width;

        projection
          .scale(width / 2)
          .clipAngle(90)
          .translate([width / (window.innerWidth < 400 ? 1.8 : 1.8), height / 2])
          .precision(.5);

        arr.forEach(o => {
          var r = o.svg.node().getBoundingClientRect(),
            l = r.left,
            t = r.top;

          o.svg.attr("width", w).attr("height", height);

          o.canvas.setAttribute("width", width);
          o.canvas.setAttribute("height", height);
          o.context.uniform2f(o.translateUniform, width / 2, height / 2);
          o.context.uniform1f(o.scaleUniform, height / 2);
          o.context.viewport(0, 0, width, height);  

          d3.select(o.canvas)
            .style("left", (l + (w - width) / 2) + "px")
            .style("top", t + "px");  
        });
        
        d3.selectAll("path").attr("d", path);

        var spin_me = d3.select(".spin-me");
        var spin_me_width = spin_me.node().getBoundingClientRect().width;
        spin_me
          .style("left", container_left + (container_width / 2) - (spin_me_width / 2) + "px")
          .style("top", (container_width < 400 ? container_top - 10 : container_top) + "px");
      }   

      var speed = options.isMobile ? .4 : .2;
      var timer = d3.timer(() => {
        redraw();
      });

      var inertia = d3.geoInertiaDrag(d3.selectAll("svg"), () => redraw(true), projection);

      function redraw(clicked){
        if (clicked) timer.stop();

        var r = clicked ? projection.rotate() : rotation.map((d, i) => i === 1 ? d >= 0 ? 0 : d += speed / 2 : i === 0 ? d -= speed : d);
        rotation = r;
        projection.rotate(rotation);
        arr.forEach(o => {
          o.context.uniform3fv(o.rotateUniform, rotation); // Three-axis rotation
          o.context.bindTexture(o.context.TEXTURE_2D, o.texture); // XXX Safari
          o.context.drawArrays(o.context.TRIANGLE_FAN, 0, 4);
        });

        d3.selectAll("path").attr("d", path);      
      }
    
    } // end jsonLoaded()

  }
}

function keepNumber(x){
  return x.replace(/[^\d.-]/g, "");
}

module.exports = spinnyGlobe;
