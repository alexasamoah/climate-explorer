(function () {
  var state = {
    data: [],
    predictions: [],
    year: 2019,
    continent: "All",
    threshold: 0,
    play: false
  };

  var tooltip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0);

  Promise.all([
    d3.json("data/co2_data.json"),
    d3.json("data/predictions.json"),
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
  ]).then(function (res) {
    state.raw = res[0];
    state.data = res[0].records;
    state.predictions = res[1].predictions;
    state.world = topojson.feature(res[2], res[2].objects.countries);

    initFilters();
    buildInsights();
    renderAll();

    d3.select("#playBubble").on("click", playBubble);
    d3.select("#playRace").on("click", playRace);
  });

  function filteredData() {
    return state.data.filter(function (d) {
      return d.year === state.year &&
        (state.continent === "All" || d.continent === state.continent) &&
        d.co2 >= state.threshold;
    });
  }

  function initFilters() {
    var continents = ["All"].concat(Array.from(new Set(state.data.map(function (d) { return d.continent; }))));
    d3.select("#continentFilter").selectAll("option")
      .data(continents).enter().append("option").text(function (d) { return d; });

    d3.select("#yearRange").on("input", function () {
      state.year = +this.value;
      d3.select("#yearLabel").text(state.year);
      renderAll();
    });
    d3.select("#continentFilter").on("change", function () {
      state.continent = this.value;
      renderAll();
    });
    d3.select("#co2Threshold").on("input", function () {
      state.threshold = +this.value;
      d3.select("#thresholdLabel").text(state.threshold + " Mt");
      renderAll();
    });

    var countries = Array.from(new Set(state.data.map(function (d) { return d.country; }))).sort();
    d3.select("#compareSelect").selectAll("option").data(countries).enter().append("option").text(function (d) { return d; });
    d3.select("#compareSelect").on("change", renderComparison);
  }

  function renderAll() {
    renderMap();
    renderBubble();
    renderBarRace();
    renderLine();
    renderScatter();
    renderCluster();
    renderComparison();
  }

  function buildInsights() {
    var cards = [
      "Top emitters continue to dominate global totals in 2019.",
      "GDP per capita and CO2 per capita remain positively correlated.",
      "Cluster analysis reveals 4 distinct country emission archetypes.",
      "Temperature anomaly trends upward in many high-emission paths."
    ];
    d3.select("#insightCards").selectAll("div.insight").data(cards).enter()
      .append("div").attr("class", "insight").text(function (d) { return d; });
  }

  function renderMap() {
    var data = filteredData();
    var byIso = {};
    data.forEach(function (d) { byIso[d.iso_code] = d.co2_per_capita; });

    var container = d3.select("#mapChart");
    container.selectAll("*").remove();
    var w = container.node().clientWidth, h = 350;
    var svg = container.append("svg").attr("width", w).attr("height", h);
    var projection = d3.geoNaturalEarth1().fitSize([w, h], state.world);
    var path = d3.geoPath().projection(projection);
    var color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, d3.max(data, function (d) { return d.co2_per_capita; }) || 20]);

    svg.selectAll("path").data(state.world.features).enter().append("path")
      .attr("d", path)
      .attr("fill", "#202c4f")
      .transition().duration(1000)
      .attr("fill", function (d) {
        var v = byIso[d.id];
        return v ? color(v) : "#1a2442";
      });
  }

  function renderBubble() {
    var data = filteredData();
    var c = d3.select("#bubbleChart");
    c.selectAll("*").remove();
    var w = c.node().clientWidth, h = 330, p = 45;
    var svg = c.append("svg").attr("width", w).attr("height", h);

    var x = d3.scaleLog().domain(d3.extent(data, function (d) { return d.gdp_per_capita; })).range([p, w - p]);
    var y = d3.scaleLinear().domain([0, d3.max(data, function (d) { return d.co2_per_capita; })]).nice().range([h - p, p]);
    var r = d3.scaleSqrt().domain(d3.extent(data, function (d) { return d.population; })).range([3, 30]);
    var color = d3.scaleOrdinal(d3.schemeSet2);

    svg.append("g").attr("transform", "translate(0," + (h - p) + ")").call(d3.axisBottom(x).ticks(6, "~s"));
    svg.append("g").attr("transform", "translate(" + p + ",0)").call(d3.axisLeft(y));

    svg.selectAll("circle").data(data).enter().append("circle")
      .attr("cx", function (d) { return x(d.gdp_per_capita); })
      .attr("cy", function (d) { return y(d.co2_per_capita); })
      .attr("r", 0)
      .attr("fill", function (d) { return color(d.continent); })
      .attr("opacity", .8)
      .on("mouseover", function (d) {
        tooltip.style("opacity", 1).html("<strong>" + d.country + "</strong><br>CO2/cap: " + d.co2_per_capita.toFixed(2));
      })
      .on("mousemove", function () {
        tooltip.style("left", (d3.event.pageX + 12) + "px").style("top", (d3.event.pageY - 28) + "px");
      })
      .on("mouseout", function () { tooltip.style("opacity", 0); })
      .transition().duration(900)
      .attr("r", function (d) { return r(d.population); });
  }

  function renderBarRace() {
    var yearData = filteredData().sort(function (a, b) { return b.co2 - a.co2; }).slice(0, 15);
    var c = d3.select("#barRaceChart");
    c.selectAll("*").remove();
    var w = c.node().clientWidth, h = 350, p = 45;
    var svg = c.append("svg").attr("width", w).attr("height", h);

    var x = d3.scaleLinear().domain([0, d3.max(yearData, function (d) { return d.co2; })]).range([p, w - p]);
    var y = d3.scaleBand().domain(yearData.map(function (d) { return d.country; })).range([p, h - p]).padding(.2);

    svg.append("g").attr("transform", "translate(0," + (h - p) + ")").call(d3.axisBottom(x).ticks(5, "~s"));
    svg.append("g").attr("transform", "translate(" + p + ",0)").call(d3.axisLeft(y));

    svg.selectAll("rect").data(yearData).enter().append("rect")
      .attr("x", p).attr("y", function (d) { return y(d.country); })
      .attr("height", y.bandwidth()).attr("width", 0)
      .attr("fill", "#ff595e")
      .transition().duration(1000)
      .attr("width", function (d) { return x(d.co2) - p; });
  }

  function renderLine() {
    var c = d3.select("#lineChart");
    c.selectAll("*").remove();
    var w = c.node().clientWidth, h = 340, p = 45;
    var svg = c.append("svg").attr("width", w).attr("height", h);
    var yearly = d3.nest().key(function (d) { return d.year; }).rollup(function (v) {
      return {
        co2: d3.mean(v, function (d) { return d.co2_per_capita; }),
        temp: d3.mean(v, function (d) { return d.temperature_change; })
      };
    }).entries(state.data).map(function (d) {
      return { year: +d.key, co2: d.value.co2, temp: d.value.temp };
    });

    var x = d3.scaleLinear().domain([2010, 2019]).range([p, w - p]);
    var y = d3.scaleLinear().domain([0, d3.max(yearly, function (d) { return Math.max(d.co2, d.temp * 15); })]).range([h - p, p]);
    svg.append("g").attr("transform", "translate(0," + (h - p) + ")").call(d3.axisBottom(x).tickFormat(d3.format("d")));
    svg.append("g").attr("transform", "translate(" + p + ",0)").call(d3.axisLeft(y));

    var line1 = d3.line().x(function (d) { return x(d.year); }).y(function (d) { return y(d.co2); });
    var line2 = d3.line().x(function (d) { return x(d.year); }).y(function (d) { return y(d.temp * 15); });

    svg.append("path").datum(yearly).attr("fill", "none").attr("stroke", "#11d3bc").attr("stroke-width", 2.5).attr("d", line1);
    svg.append("path").datum(yearly).attr("fill", "none").attr("stroke", "#3a86ff").attr("stroke-width", 2.5).attr("d", line2);
  }

  function renderScatter() {
    var data = filteredData();
    var c = d3.select("#scatterChart");
    c.selectAll("*").remove();
    var w = c.node().clientWidth, h = 330, p = 45;
    var svg = c.append("svg").attr("width", w).attr("height", h);

    var x = d3.scaleLinear().domain(d3.extent(data, function (d) { return d.gdp_per_capita; })).nice().range([p, w - p]);
    var y = d3.scaleLinear().domain(d3.extent(data, function (d) { return d.co2_per_capita; })).nice().range([h - p, p]);

    svg.append("g").attr("transform", "translate(0," + (h - p) + ")").call(d3.axisBottom(x).ticks(5, "~s"));
    svg.append("g").attr("transform", "translate(" + p + ",0)").call(d3.axisLeft(y));

    svg.selectAll("circle").data(data).enter().append("circle")
      .attr("cx", function (d) { return x(d.gdp_per_capita); })
      .attr("cy", function (d) { return y(d.co2_per_capita); })
      .attr("r", 4)
      .attr("fill", "#11d3bc")
      .attr("opacity", .7);

    var lx = d3.mean(data, function (d) { return d.gdp_per_capita; });
    var ly = d3.mean(data, function (d) { return d.co2_per_capita; });
    var slope = d3.sum(data, function (d) { return (d.gdp_per_capita - lx) * (d.co2_per_capita - ly); }) /
      d3.sum(data, function (d) { return Math.pow(d.gdp_per_capita - lx, 2); });
    var intercept = ly - slope * lx;
    var xs = d3.extent(data, function (d) { return d.gdp_per_capita; });
    var linePts = xs.map(function (v) { return { x: v, y: slope * v + intercept }; });

    svg.append("line")
      .attr("x1", x(linePts[0].x)).attr("y1", y(linePts[0].y))
      .attr("x2", x(linePts[0].x)).attr("y2", y(linePts[0].y))
      .attr("stroke", "#ff595e").attr("stroke-width", 2)
      .transition().duration(1000)
      .attr("x2", x(linePts[1].x)).attr("y2", y(linePts[1].y));
  }

  function renderCluster() {
    var data = filteredData();
    var c = d3.select("#clusterChart");
    c.selectAll("*").remove();
    var w = c.node().clientWidth, h = 330;
    var svg = c.append("svg").attr("width", w).attr("height", h);
    var color = d3.scaleOrdinal().domain([0, 1, 2, 3]).range(["#11d3bc", "#3a86ff", "#ffd166", "#ff595e"]);

    var sim = d3.forceSimulation(data)
      .force("x", d3.forceX(w / 2).strength(.03))
      .force("y", d3.forceY(h / 2).strength(.03))
      .force("collide", d3.forceCollide(7))
      .stop();

    for (var i = 0; i < 120; i++) sim.tick();

    svg.selectAll("circle").data(data).enter().append("circle")
      .attr("cx", function (d) { return d.x; })
      .attr("cy", function (d) { return d.y; })
      .attr("r", 0)
      .attr("fill", function (d) { return color(d.cluster); })
      .transition().duration(900).attr("r", 6).attr("opacity", .85);
  }

  function renderComparison() {
    var selected = Array.from(document.getElementById("compareSelect").selectedOptions).slice(0, 4).map(function (o) { return o.value; });
    var data = state.data.filter(function (d) { return d.year === state.year && selected.indexOf(d.country) > -1; });
    var c = d3.select("#compareChart");
    c.selectAll("*").remove();
    if (!data.length) return;

    var w = c.node().clientWidth, h = 300;
    var svg = c.append("svg").attr("width", w).attr("height", h);
    var metrics = ["co2_per_capita", "gdp_per_capita", "temperature_change", "co2_intensity"];
    var scaleR = d3.scaleLinear().domain([0, d3.max(data, function (d) {
      return d3.max(metrics, function (m) { return d[m]; });
    })]).range([20, 100]);

    var g = svg.append("g").attr("transform", "translate(" + w / 2 + "," + h / 2 + ")");
    metrics.forEach(function (m, i) {
      var a = (Math.PI * 2 / metrics.length) * i - Math.PI / 2;
      g.append("line").attr("x1", 0).attr("y1", 0).attr("x2", Math.cos(a) * 110).attr("y2", Math.sin(a) * 110).attr("stroke", "#355188");
      g.append("text").attr("x", Math.cos(a) * 125).attr("y", Math.sin(a) * 125).text(m.replace("_", " "));
    });

    var color = d3.scaleOrdinal(d3.schemeSet2);
    data.forEach(function (d, i) {
      var points = metrics.map(function (m, j) {
        var a = (Math.PI * 2 / metrics.length) * j - Math.PI / 2;
        return [Math.cos(a) * scaleR(d[m]), Math.sin(a) * scaleR(d[m])];
      });
      points.push(points[0]);
      var line = d3.line();
      g.append("path")
        .attr("d", line(points))
        .attr("fill", color(i))
        .attr("stroke", color(i))
        .attr("opacity", 0)
        .transition().duration(900)
        .attr("opacity", .35);
    });
  }

  function playBubble() {
    if (state.play) return;
    state.play = true;
    var y = 2010;
    var timer = d3.interval(function () {
      state.year = y;
      d3.select("#yearRange").property("value", y);
      d3.select("#yearLabel").text(y);
      renderAll();
      y++;
      if (y > 2019) {
        timer.stop();
        state.play = false;
      }
    }, 1100);
  }

  function playRace() { playBubble(); }
})();
