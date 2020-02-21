var margin = {top: 100, right: 130, bottom: 20, left: 188, line_top: 80, line_bottom: 70},
    width = document.body.clientWidth - margin.left - margin.right,
    height = 740 + 500 + margin.line_top + margin.line_bottom - margin.top - margin.bottom,
    innerHeight = 740 - margin.top - margin.bottom;

var devicePixelRatio = window.devicePixelRatio || 1;

var color = d3.scaleOrdinal()
  .domain(["Radial Velocity", "Imaging", "Eclipse Timing Variations", "Astrometry", "Microlensing", "Orbital Brightness Modulation", "Pulsar Timing", "Pulsation Timing Variations", "Transit", "Transit Timing Variations"])
  .range(["#DB7F85", "#50AB84", "#4C6C86", "#C47DCB", "#B59248", "#DD6CA7", "#E15E5A", "#5DA5B3", "#725D82", "#54AF52", "#954D56", "#8C92E8", "#D8597D", "#AB9C27", "#D67D4B", "#D58323", "#BA89AD", "#357468", "#8F86C2", "#7D9E33", "#517C3F", "#9D5130", "#5E9ACF", "#776327", "#944F7E"]);

var types = {
  "Number": {
    key: "Number",
    coerce: function(d) { return +d; },
    extent: d3.extent,
    within: function(d, extent, dim) { return extent[0] <= dim.scale(d) && dim.scale(d) <= extent[1]; },
    defaultScale: d3.scaleLinear().range([innerHeight, 0])
  },
  "String": {
    key: "String",
    coerce: String,
    extent: function (data) { return data.sort(); },
    within: function(d, extent, dim) { return extent[0] <= dim.scale(d) && dim.scale(d) <= extent[1]; },
    defaultScale: d3.scalePoint().range([0, innerHeight])
  },
};

var dimensions = [
  {
  	key: "actor",
  	description: "Responsible party",
  	type: types["String"],
  },
  {
  	key: "action",
  	description: "Method of Data Breach",
  	type: types["String"],
  },
  {
  	key: "industry",
  	description: "Industry of victim",
  	type: types["String"],
  },
  {
  	key: "year",
  	description: "Incident year",
  	type: types["Number"],
  }
 ];

var xscale = d3.scalePoint()
    .domain(d3.range(dimensions.length))
    .range([0, width]);

var yAxis = d3.axisLeft();

var container = d3.select("body").append("div")
    .attr("class", "parcoords")
    .style("width", width + margin.left + margin.right + "px")
    .style("height", height + margin.top + margin.bottom + "px");

var svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var canvas = container.append("canvas")
    .attr("width", width * devicePixelRatio)
    .attr("height", height * devicePixelRatio)
    .style("width", width + "px")
    .style("height", height + "px")
    .style("margin-top", margin.top + "px")
    .style("margin-left", margin.left + "px");

var ctx = canvas.node().getContext("2d");
ctx.globalCompositeOperation = 'darken';
ctx.globalAlpha = 0.15;
ctx.lineWidth = 1.5;
ctx.scale(devicePixelRatio, devicePixelRatio);

var output = d3.select("body").append("pre");

var axes = svg.selectAll(".axis")
    .data(dimensions)
  .enter().append("g")
    .attr("class", function(d) { return "axis " + d.key.replace(/ /g, "_"); })
    .attr("transform", function(d,i) { return "translate(" + xscale(i) + ")"; });

var path_to_csv = "https://raw.githubusercontent.com/TheoHiraclides/DataVizCyberAttack/master/vcdbcust.csv"

d3.csv(path_to_csv, function(error, data) {
  if (error) throw error;

  data.forEach(function(d) {
    dimensions.forEach(function(p) {
      d[p.key] = !d[p.key] ? null : p.type.coerce(d[p.key]);
    });

    link_key = "article link";

    // truncate long text strings to fit in data table, not done on the article link as it would mess it up
    for (var key in d) {
      if (key != link_key && d[key] && d[key].length > 35) d[key] = d[key].slice(0,36);
    }

    // remove additional links
    if (d[link_key].indexOf(" ") >= 0) {
    	d[link_key] = d[link_key].substring(0, d[link_key].indexOf(" ") );
    }

    // create hypertext links
    if (d[link_key].startsWith("http")) {
	    if (d[link_key].length > 71) {
	    	d[link_key] = "<a href='"+d[link_key]+"'>"+d[link_key].slice(0,72)+"</a>";
	    } else {
	    	d[link_key] = "<a href='"+d[link_key]+"'>"+d[link_key]+"</a>";
		}
	}
  });

  // type/dimension default setting happens here
  dimensions.forEach(function(dim) {
    if (!("domain" in dim)) {
      // detect domain using dimension type's extent function
      dim.domain = d3_functor(dim.type.extent)(data.map(function(d) { return d[dim.key]; }));
    }
    if (!("scale" in dim)) {
      // use type's default scale for dimension
      dim.scale = dim.type.defaultScale.copy();
    }
    dim.scale.domain(dim.domain);
  });

  var render = renderQueue(draw).rate(30);

  ctx.clearRect(0,0,width,height);
  ctx.globalAlpha = d3.min([1.15/Math.pow(data.length,0.3),1]);
  render(data);

  axes.append("g")
      .each(function(d) {
        var renderAxis = "axis" in d
          ? d.axis.scale(d.scale)  // custom axis
          : yAxis.scale(d.scale);  // default axis
        d3.select(this).call(renderAxis);
      })
    .append("text")
      .attr("class", "title")
      .attr("text-anchor", "start")
      .text(function(d) { return "description" in d ? d.description : d.key; });

  // Add and store a brush for each axis.
  axes.append("g")
      .attr("class", "brush")
      .each(function(d) {
        d3.select(this).call(d.brush = d3.brushY()
          .extent([[-10,0], [10,height]])
          .on("start", brushstart)
          .on("brush", brush)
          .on("end", brush)
        )
      })
    .selectAll("rect")
      .attr("x", -8)
      .attr("width", 16);

  d3.selectAll(".axis.actor .tick text")
    .style("fill", color);

  data_agg_flat = d3.nest()
    .key(function (d) {return d.year+d.action; })
    .rollup(function(v) { return v.length; })
    .entries(data);

  data_agg = d3.nest()
    .key(function (d) {return d.action; })
    .entries(data);

  data_agg.forEach(function(data_part) {
    data_part.values = d3.nest()
      .key(function (d) {return +d.year; })
      .rollup(function(v) { return v.length; })
      .entries(data_part.values);

    data_part.values.forEach(function(d) { d.key = +d.key; })

    data_part.values = data_part.values.sort(function(x, y){
      return d3.ascending(x.key, y.key);
    })
  })
      
  var x_line = d3.scaleLinear()
    .domain((d3.extent(data, function (d) { return +d.year; })))
    .range([0, width]);

  var y_line = d3.scaleLinear()
    .domain([0, d3.max(data_agg_flat, function (d) { return d.value; })])
    .range([height - margin.line_bottom, innerHeight + margin.line_top]);

  svg.append("g")
    .attr("transform", "translate(0," + (height - margin.line_bottom) + ")")
    .attr("class", "xaxis")
    .call(d3.axisBottom(x_line).ticks(10));

  svg.append("g")
    .attr("class", "yaxis")
    .call(d3.axisLeft(y_line));
      
  var line = d3.line()
    .x(function(d) { return x_line(d.key) })
    .y(function(d) { return y_line(d.value) })

  let color_list = d3.scaleOrdinal(d3.schemeCategory10)
  var cutoff = 15

  svg.selectAll(".line")
    .data(data_agg)
    .enter()
      .append("path")
      .attr("class", "line")
      .style("stroke", function(d) { return d.color = color_list(d.key); })
      .attr("fill", 'none')
      .attr("id", function(d) { return 'tag'+d.key.replace(/\s+/g, ''); })
      .attr("d", function(d) { return line(d.values); } );
  
  output.html(d3.tsvFormat(data.slice(0,24)));

  function project(d) {
    return dimensions.map(function(p,i) {
      // check if data element has property and contains a value
      if (
        !(p.key in d) ||
        d[p.key] === null
      ) return null;

      return [xscale(i),p.scale(d[p.key])];
    });
  };

  function draw(d) {
    ctx.strokeStyle = color(d.actor);
    ctx.beginPath();
    var coords = project(d);
    coords.forEach(function(p,i) {
      // this tricky bit avoids rendering null values as 0
      if (p === null) {
        // this bit renders horizontal lines on the previous/next
        // dimensions, so that sandwiched null values are visible
        if (i > 0) {
          var prev = coords[i-1];
          if (prev !== null) {
            ctx.moveTo(prev[0],prev[1]);
            ctx.lineTo(prev[0]+6,prev[1]);
          }
        }
        if (i < coords.length-1) {
          var next = coords[i+1];
          if (next !== null) {
            ctx.moveTo(next[0]-6,next[1]);
          }
        }
        return;
      }
      
      if (i == 0) {
        ctx.moveTo(p[0],p[1]);
        return;
      }

      ctx.lineTo(p[0],p[1]);
    });
    ctx.stroke();
  }

  function brushstart() {
    d3.event.sourceEvent.stopPropagation();
  }

  // Handles a brush event, toggling the display of foreground lines.
  function brush() {
    render.invalidate();

    var actives = [];
    svg.selectAll(".axis .brush")
      .filter(function(d) {
        return d3.brushSelection(this);
      })
      .each(function(d) {
        actives.push({
          dimension: d,
          extent: d3.brushSelection(this)
        });
      });

    var selected = data.filter(function(d) {
      if (actives.every(function(active) {
          var dim = active.dimension;
          // test if point is within extents for each active brush
          return dim.type.within(d[dim.key], active.extent, dim);
        })) {
        return true;
      }
    });

    ctx.clearRect(0,0,width,height);
    ctx.globalAlpha = d3.min([0.85/Math.pow(selected.length,0.3),1]);
    render(selected);

    data_agg_flat = d3.nest()
      .key(function (d) {return d.year+d.action; })
      .rollup(function(v) { return v.length; })
      .entries(selected);

    data_agg = d3.nest()
      .key(function (d) {return d.action; })
      .entries(selected);

    data_agg.forEach(function(data_part) {
      data_part.values = d3.nest()
        .key(function (d) {return +d.year; })
        .rollup(function(v) { return v.length; })
        .entries(data_part.values);

      data_part.values.forEach(function(d) { d.key = +d.key; })

      data_part.values = data_part.values.sort(function(x, y){
          return d3.ascending(x.key, y.key);
      })
    })

    var line_i = 0

    var cutoff = 15

    while (line_i < data_agg.length) {
   	  var sum = 0;
      data_agg[line_i].values.forEach(function(v) { sum += v.value; })
      if (sum < cutoff) {
      	data_agg.splice(line_i, 1);
      } else {
      	line_i += 1;
      }
    }
      
    console.log(data_agg);
    console.log([0, d3.max(data_agg_flat, function (d) { return d.value; })])

    var x_line = d3.scaleLinear()
      .domain((d3.extent(selected, function (d) { return +d.year; })))
      .range([0, width]);

    var y_line = d3.scaleLinear()
      .domain([0, d3.max(data_agg_flat, function (d) { return d.value; })])
      .range([height - margin.line_bottom, innerHeight + margin.line_top]);

    svg.selectAll(".xaxis")
	  .transition()
	  .duration(1000)
      .call(d3.axisBottom(x_line).ticks(10));

    svg.selectAll(".yaxis")
	  .transition()
	  .duration(1000)
	  .call(d3.axisLeft(y_line));
      
    var line = d3.line()
      .x(function(d) { return x_line(d.key) })
      .y(function(d) { return y_line(d.value) })

    let color_list = d3.scaleOrdinal(d3.schemeCategory10)

    lines = svg.selectAll(".line")
    	.data([])

    lines
      .exit()
      .remove()

    lines
      .data(data_agg)
      .enter()
        .append("path")
        .attr("class", "line")
        .style("stroke", function(d) { return d.color = color_list(d.key); })
        .attr("fill", 'none')
        .attr("id", function(d) { return 'tag'+d.key.replace(/\s+/g, ''); })
        .attr("d", function(d) { return line(d.values); } );

    output.html(d3.tsvFormat(selected.slice(0,24)));
  }
});

function d3_functor(v) {
  return typeof v === "function" ? v : function() { return v; };
};

function tsv_formatter(d) {
	keys = d[0].keys;
	output = keys.join("\t");
	output += "\n";
	d.forEach(function (l) {
		var values = keys.map(function (k) { return toString(l[k]) });
		output = values.join("\t");
		output += "\n";
	});
};