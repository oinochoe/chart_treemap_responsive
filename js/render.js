(function () {
    "use strict";
    const margin = { top: 24, right: 0, bottom: 0, left: 0 };
    const width = 1000;
    const height = 1500;
    const formatNumber = d3.format(",d");
    const testData = data;

    let chartTree;
    let svg;
    let chartBar;
    let transitioning;

    // 상승 금색, 하락 네이비
    // 11 개 -> 3뎁스
    // techonology 2뎁스 (상승 하락에 따른 네비게이션 색상)
    // 초기에 사라지고 2뎁스부터 나타나기
    // 시총에 따른 크기 비율
    // 시간체크해서 장시간 아닐 때 디폴트 색상
    // 다크모드일 때 색상 정하기

    const x = d3.scaleLinear().domain([0, width]).range([0, width]);
    const y = d3
        .scaleLinear()
        .domain([0, height - margin.top - margin.bottom])
        .range([0, height - margin.top - margin.bottom]);

    const colorMap = ["#212348", "#3681C4", "#1D8F59", "#F3B448", "#DA4747"];

    const color = d3.scaleOrdinal().range(
        colorMap.map(function (c) {
            c = d3.rgb(c);
            c.opacity = 0.8;
            return c;
        })
    );

    const initialState = d3
        .hierarchy(testData)
        .eachBefore(function (d) {
            d.id = (d.parent ? d.parent.id + "." : "") + d.data.shortName;
        })
        .sum((d) => d.size)
        .sort(function (a, b) {
            return b.height - a.height || b.value - a.value;
        });

    // init
    const valueChartInit = () => {
        if (svg) {
            svg.selectAll("*").remove();
        } else {
            svg = d3
                .select(".js-domain")
                .append("svg")
                .attr("width", width - margin.left - margin.right)
                .attr("height", height - margin.bottom - margin.top)
                .style("margin-left", -margin.left + "px")
                .style("margin.right", -margin.right + "px")
                .append("g")
                .attr(
                    "transform",
                    "translate(" + margin.left + "," + margin.top + ")"
                )
                .style("shape-rendering", "crispEdges");

            chartBar = svg.append("g").attr("class", "chartBar");

            chartBar
                .append("rect")
                .attr("y", -margin.top)
                .attr("width", width)
                .attr("height", margin.top);

            chartBar
                .append("text")
                .attr("x", 6) // 차트 제목 x 좌표
                .attr("y", 6 - margin.top) // 차트 제목 y 좌표
                .attr("dy", ".75em"); // 차트 제목 전체 높이

            // 차트 트리 분포도
            chartTree = d3
                .treemap()
                .tile(
                    d3.treemapResquarify.ratio(
                        (height / width) * 0.5 * (1 + Math.sqrt(5))
                    )
                )
                .size([width, height])
                .round(false)
                .paddingInner(0);
        }

        initialize(initialState);
        accumulate(initialState);
        chartLayout(initialState);
        chartTree(initialState);
        chartDisplay(initialState);
    };

    const initialize = (defValue) => {
        defValue.x = defValue.y = 0;
        defValue.x1 = width;
        defValue.y1 = height;
        defValue.depth = 0;
    };

    const accumulate = (defValue) => {
        return (defValue._children = defValue.children)
            ? (defValue.value = defValue.children.reduce(function (p, v) {
                  return p + accumulate(v);
              }, 0))
            : defValue.value;
    };

    const chartLayout = (defValue) => {
        if (defValue._children) {
            defValue._children.forEach((c) => {
                c.x0 = defValue.x0 + c.x0 * defValue.x1;
                c.y0 = defValue.y0 + c.y0 * defValue.y1;
                c.x1 *= defValue.x1 - defValue.x0;
                c.y1 *= defValue.y1 - defValue.y0;
                c.parent = defValue;
                chartLayout(c);
            });
        }
    };

    const chartDisplay = (d) => {
        chartBar
            .datum(d.parent)
            .on("click", transition)
            .select("text")
            .text(chartName(d));

        const g1 = svg.insert("g", ".chartBar").datum(d).attr("class", "depth");
        const g = g1.selectAll("g").data(d._children).enter().append("g");

        g.filter(function (datum) {
            return datum._children;
        })
            .classed("children", true)
            .on("click", transition);

        const children = g
            .selectAll(".child")
            .data(function (datum) {
                return datum._children || [datum];
            })
            .enter()
            .append("g");

        children
            .append("rect")
            .attr("class", "child")
            .call(rectangluar)
            .append("title")
            .text(function (datum) {
                return (
                    datum.data.shortName +
                    " (" +
                    formatNumber(datum.value) +
                    ")"
                );
            });

        children
            .append("text")
            .attr("class", "ctext")
            .text(function (datum) {
                return datum.data.shortName;
            })
            .call(textPositionBottom);

        g.append("rect").attr("class", "parent").call(rectangluar);

        const t = g.append("text").attr("class", "ptext").attr("dy", ".75em");

        t.append("tspan").text(function (datum) {
            return datum.data.shortName;
        });

        t.append("tspan")
            .attr("dy", "1.0em")
            .text(function (datum) {
                return formatNumber(datum.value);
            });

        t.call(textPositionTop);

        g.selectAll("rect").style("fill", function (datum) {
            return color(datum.data.shortName);
        });

        function transition(datum) {
            if (transitioning || !datum) return;
            transitioning = true;
            const g2 = chartDisplay(datum),
                t1 = g1.transition().duration(500),
                t2 = g2.transition().duration(500);
            x.domain([datum.x0, datum.x0 + (datum.x1 - datum.x0)]);
            y.domain([datum.y0, datum.y0 + (datum.y1 - datum.y0)]);

            svg.style("shape-rendering", null);

            svg.selectAll(".depth").sort((a, b) => {
                return a.depth - b.depth;
            });

            g2.selectAll("text").style("fill-opacity", 0);

            t1.selectAll(".ptext")
                .call(textPositionTop)
                .style("fill-opacity", 0);
            t2.selectAll(".ptext")
                .call(textPositionTop)
                .style("fill-opacity", 1);
            t1.selectAll(".ctext")
                .call(textPositionBottom)
                .style("fill-opacity", 0);
            t2.selectAll(".ctext")
                .call(textPositionBottom)
                .style("fill-opacity", 1);
            t1.selectAll("rect").call(rectangluar);
            t2.selectAll("rect").call(rectangluar);

            // Remove the old node when the transition is finished.
            t1.remove().on("end", function () {
                svg.style("shape-rendering", "crispEdges");
                transitioning = false;
            });
        }
        return g;
    };

    const textPositionTop = (datum) => {
        datum.selectAll("tspan").attr("x", function (d) {
            return x(d.x0) + 6;
        });
        datum
            .attr("x", function (d) {
                return x(d.x0) + 6;
            })
            .attr("y", function (d) {
                return y(d.y0) + 3;
            })
            .style("opacity", function (d) {
                var w = x(d.x1) - x(d.x0);
                return this.getComputedTextLength() < w - 6 ? 1 : 0;
            });
    };

    const textPositionBottom = (datum) => {
        datum
            .attr("x", function (d) {
                return x(d.x1) - this.getComputedTextLength() - 6;
            })
            .attr("y", function (d) {
                return y(d.y1) - 6;
            })
            .style("opacity", function (d) {
                var w = x(d.x1) - x(d.x0);
                return this.getComputedTextLength() < w - 6 ? 1 : 0;
            });
    };

    const rectangluar = (rect) => {
        rect.attr("x", function (d) {
            return x(d.x0);
        })
            .attr("y", function (d) {
                return y(d.y0);
            })
            .attr("width", function (d) {
                var w = x(d.x1) - x(d.x0);
                return w;
            })
            .attr("height", function (d) {
                var h = y(d.y1) - y(d.y0);
                return h;
            });
    };

    const chartName = (datum) => {
        return datum.parent
            ? chartName(datum.parent) +
                  " / " +
                  datum.data.shortName +
                  " (" +
                  formatNumber(datum.value) +
                  ")"
            : datum.data.shortName + " (" + formatNumber(datum.value) + ")";
    };

    valueChartInit();
})();
