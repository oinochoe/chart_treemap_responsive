(function () {
    "use strict";
    const margin = { top: 24, right: 0, bottom: 0, left: 0 };
    const width = 1200;
    const height = 530;
    const formatNumber = d3.format(",d");

    let treemap;
    let svg, grandparent;
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

    const colorMap = ["#F3B448", "#212348"];

    const color = d3.scaleOrdinal().range(
        colorMap.map(function (c) {
            c = d3.rgb(c);
            c.opacity = 0.6;
            return c;
        })
    );

    updateDrillDown();

    function updateDrillDown() {
        if (svg) {
            svg.selectAll("*").remove();
        } else {
            svg = d3
                .select("#domainDrillDown")
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

            grandparent = svg.append("g").attr("class", "grandparent");

            grandparent
                .append("rect")
                .attr("y", -margin.top)
                .attr("width", width)
                .attr("height", margin.top);

            grandparent
                .append("text")
                .attr("x", 6)
                .attr("y", 6 - margin.top)
                .attr("dy", ".75em");

            treemap = d3
                .treemap()
                .tile(
                    d3.treemapResquarify.ratio(
                        (height / width) * 0.5 * (1 + Math.sqrt(5))
                    )
                )
                .size([width, height])
                .round(false)
                .paddingInner(1);
        }

        var root = d3
            .hierarchy(data2)
            .eachBefore(function (d) {
                d.id = (d.parent ? d.parent.id + "." : "") + d.data.shortName;
            })
            .sum((d) => d.size)
            .sort(function (a, b) {
                console.log("initial root sort a " + a.value + " b " + b.value);
                return b.height - a.height || b.value - a.value;
            });

        initialize(root);
        accumulate(root);
        layout(root);
        treemap(root);
        display(root);
    }

    function initialize(root) {
        root.x = root.y = 0;
        root.x1 = width;
        root.y1 = height;
        root.depth = 0;
    }

    function accumulate(d) {
        console.log("accumulate called " + d.data.name);
        return (d._children = d.children)
            ? (d.value = d.children.reduce(function (p, v) {
                  return p + accumulate(v);
              }, 0))
            : d.value;
    }

    function layout(d) {
        if (d._children) {
            d._children.forEach(function (c) {
                c.x0 = d.x0 + c.x0 * d.x1;
                c.y0 = d.y0 + c.y0 * d.y1;
                c.x1 *= d.x1 - d.x0;
                c.y1 *= d.y1 - d.y0;
                c.parent = d;
                layout(c);
            });
        }
    }

    function display(d) {
        grandparent
            .datum(d.parent)
            .on("click", transition)
            .select("text")
            .text(name(d));

        var g1 = svg
            .insert("g", ".grandparent")
            .datum(d)
            .attr("class", "depth");

        var g = g1.selectAll("g").data(d._children).enter().append("g");

        g.filter(function (d) {
            return d._children;
        })
            .classed("children", true)
            .on("click", transition);

        var children = g
            .selectAll(".child")
            .data(function (d) {
                return d._children || [d];
            })
            .enter()
            .append("g");

        children
            .append("rect")
            .attr("class", "child")
            .call(rect)
            .append("title")
            .text(function (d) {
                return d.data.shortName + " (" + formatNumber(d.value) + ")";
            });

        children
            .append("text")
            .attr("class", "ctext")
            .text(function (d) {
                return d.data.shortName;
            })
            .call(text2);

        g.append("rect").attr("class", "parent").call(rect);

        var t = g.append("text").attr("class", "ptext").attr("dy", ".75em");

        t.append("tspan").text(function (d) {
            return d.data.shortName;
        });

        t.append("tspan")
            .attr("dy", "1.0em")
            .text(function (d) {
                return formatNumber(d.value);
            });

        t.call(text);

        g.selectAll("rect").style("fill", function (d) {
            return color(d.data.shortName);
        });

        function transition(d) {
            if (transitioning || !d) return;
            transitioning = true;
            var g2 = display(d),
                t1 = g1.transition().duration(750),
                t2 = g2.transition().duration(750);
            x.domain([d.x0, d.x0 + (d.x1 - d.x0)]);
            y.domain([d.y0, d.y0 + (d.y1 - d.y0)]);

            // Enable anti-aliasing during the transition.
            svg.style("shape-rendering", null);

            // Draw child nodes on top of parent nodes.
            svg.selectAll(".depth").sort(function (a, b) {
                console.log(".depth sort a " + a.depth + " b " + b.depth);
                return a.depth - b.depth;
            });

            // Fade-in entering text.
            g2.selectAll("text").style("fill-opacity", 0);

            // Transition to the new view.
            t1.selectAll(".ptext").call(text).style("fill-opacity", 0);
            t2.selectAll(".ptext").call(text).style("fill-opacity", 1);
            t1.selectAll(".ctext").call(text2).style("fill-opacity", 0);
            t2.selectAll(".ctext").call(text2).style("fill-opacity", 1);
            t1.selectAll("rect").call(rect);
            t2.selectAll("rect").call(rect);

            // Remove the old node when the transition is finished.
            t1.remove().on("end", function () {
                svg.style("shape-rendering", "crispEdges");
                transitioning = false;
            });
        }
        return g;
    }

    function text(text) {
        text.selectAll("tspan").attr("x", function (d) {
            return x(d.x0) + 6;
        });
        text.attr("x", function (d) {
            return x(d.x0) + 6;
        })
            .attr("y", function (d) {
                return y(d.y0) + 3;
            })
            .style("opacity", function (d) {
                var w = x(d.x1) - x(d.x0);
                console.log(
                    "text opacity setting textlength " +
                        this.getComputedTextLength() +
                        " d size " +
                        w
                );
                return this.getComputedTextLength() < w - 6 ? 1 : 0;
            });
    }

    function text2(text) {
        text.attr("x", function (d) {
            return x(d.x1) - this.getComputedTextLength() - 6;
        })
            .attr("y", function (d) {
                return y(d.y1) - 6;
            })
            .style("opacity", function (d) {
                var w = x(d.x1) - x(d.x0);
                console.log(
                    "text2 opacity setting textlength " +
                        this.getComputedTextLength() +
                        " d size " +
                        w
                );
                return this.getComputedTextLength() < w - 6 ? 1 : 0;
            });
    }

    function rect(rect) {
        rect.attr("x", function (d) {
            return x(d.x0);
        })
            .attr("y", function (d) {
                return y(d.y0);
            })
            .attr("width", function (d) {
                var w = x(d.x1) - x(d.x0);
                console.log("id " + d.id + " rect width " + w);
                return w;
            })
            .attr("height", function (d) {
                var h = y(d.y1) - y(d.y0);
                console.log("id " + d.id + " rect height " + h);
                return h;
            });
    }

    function name(d) {
        return d.parent
            ? name(d.parent) +
                  " / " +
                  d.data.shortName +
                  " (" +
                  formatNumber(d.value) +
                  ")"
            : d.data.shortName + " (" + formatNumber(d.value) + ")";
    }
})();
