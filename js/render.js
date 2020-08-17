(function () {
    "use strict";
    const width = 100;     // 100% 로 변환
    const height = 100;    // 100% 로 변환
    const speed = 300;     // 접고 펼쳐지는 speed
    const testData = data; // data
    const formatNumber = d3.format(",d"); // number 환 형식으로 정규식
    // x 좌표 y좌표
    const x = d3.scaleLinear().domain([0, width]).range([0, width]);
    const y = d3.scaleLinear().domain([0, height]).range([0, height]);
    // color 분포
    const colorMap = [
        "#e2b752",
        "#dfb257",
        "#dcaf5c",
        "#d8ad62",
        "#ae8f59",
        "#4b4944",
        "#3e3f4c",
        "#282e4a",
        "#223162",
        "#3e5b94",
        "#4e74b2",
    ];

    let chartTree = '';     // chartTree구조
    let svg = '';           // svg
    let chartBar = '';      // chart 상단 바
    let transitioning = false; // 트랜지셔닝 효과

    // TODO
    // 11 개 -> 3뎁스
    // techonology 2뎁스 (상승 하락에 따른 네비게이션 색상)
    // 상단 바 초기에 사라지고 2뎁스부터 나타나기
    // 시간체크해서 장시간 아닐 때 디폴트 색상
    // 다크모드일 때 색상 정하기

    // 초기 상태 설정
    const initialState = d3
        .hierarchy(testData) // testData 사용
        // .eachBefore((d) => d.id =(d.parent ? d.parent.id + "." : "") + d.data.shortName)
        .sum((d) => d.size)
        .sort((a, b) => b.height - a.height || b.value - a.value);

    // initializing 함수
    const valueChartInit = () => {
        if (svg) {
            svg.selectAll("*").remove();
        } else {
            svg = d3
                .select(".js-domain")
                .append("svg")
                //.append("g")

            // chartBar 설정
            chartBar = svg.append("g").attr("class", "chartBar");
            chartBar.append("rect").attr("y", 0);
            chartBar.append("text").attr("x", 10).attr("y", 6).attr("dy", "1.2em");

            // 차트 트리 분포도
            chartTree = d3
                .treemap()
                .tile(
                    d3.treemapResquarify.ratio(
                        (height + "%" / width + "%") * 0.5 * (1 + Math.sqrt(5))
                    )
                )
                .size([width, height])
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

    // 누적 value 할당
    const accumulate = (defValue) => {
        return (defValue._children = defValue.children)
            ? (defValue.value = defValue.children.reduce( (p, v) =>  p + accumulate(v), 0))
            : defValue.value;
    };

    // 레이아웃 조절
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
        // chartBar 이벤트 설정
        chartBar
            .datum(d.parent)
            .on("click", transition)
            .select("text")
            .text(chartName(d));

        // 차트바에 그룹 설정
        const g1 = svg.insert("g", ".chartBar").datum(d).attr("class", "depth");
        // 그룹 전체 잡기
        const g = g1.selectAll("g").data(d._children).enter().append("g");
        // Link depth 설정
        const linkDepth = 3;

        g.filter((datum) => datum._children).classed("children", true).on("click", transition);

        const children = g.selectAll(".child").data((datum) => datum._children || [datum]).enter().append("g");

        children.append("rect").attr("class", "child").call(rectangluar).append("title").text((datum) =>
            datum.data.shortName + "(" + formatNumber(datum.value) + ")");

        g.append("rect").attr("class", "parent").call(rectangluar).on("click", moveLink);

        const t = g.append("text").attr("class", "ptext").attr("dy", ".45em");

        t.append("tspan").text((datum) => datum.data.shortName);

        t.append("tspan").attr("dy", "1.0em").text((datum) => formatNumber(datum.value));

        t.call(textPositionTitle);

        const categories = d.children.map(datum => datum.value)
        const color = d3.scaleLinear().domain(categories).range(
            colorMap.map((c) => {
                c = d3.rgb(c);
                c.opacity = 0.85; // 각 영역 하단 내용이 보이도록 opacity 설정
                return c;
            })
        );

        g.selectAll("rect").style("fill", (datum) => color(datum.value));

        function moveLink(datum) {
            if (datum.depth == linkDepth) {
                window.open("http://valuesight.io/#" + datum.value);
                return;
            }
        }

        // 데이터에 따른 트랜지션 설정
        function transition(datum) {
            if (transitioning || !datum) return;
            if (datum.depth >= linkDepth) return;
            if(datum.depth == 0) {
                document.querySelector('.js-domain').classList.remove('active');
                chartBar.select('text').attr('x', 10);
            } else {
                document.querySelector('.js-domain').classList.add('active');
                chartBar.select('text').attr('x', 44)
            }
            transitioning = true;
            const g2 = chartDisplay(datum),
                t1 = g1.transition().duration(speed),
                t2 = g2.transition().duration(speed);
            x.domain([datum.x0, datum.x0 + (datum.x1 - datum.x0)]);
            y.domain([datum.y0, datum.y0 + (datum.y1 - datum.y0)]);

            svg.style("shape-rendering", null);

            svg.selectAll(".depth").sort((a, b) => a.depth - b.depth);

            g2.selectAll("text").style("fill-opacity", 0);

            t1.selectAll(".ptext").call(textPositionTitle).style("fill-opacity", 0);
            t2.selectAll(".ptext").call(textPositionTitle).style("fill-opacity", 1);
            t1.selectAll(".ctext").call(textPositionNumber).style("fill-opacity", 0);
            t2.selectAll(".ctext").call(textPositionNumber).style("fill-opacity", 1);

            t1.selectAll("rect").call(rectangluar);
            t2.selectAll("rect").call(rectangluar);

            // Remove the old node when the transition is finished.
            t1.remove().on("end", () => {
                svg.style("shape-rendering", "crispEdges");
                transitioning = false;
            });
        }
        return g;
    };

    // text 중에 title 위치
    const textPositionTitle = (datum) => {
        datum.selectAll("tspan").attr("x", (d) => x(d.x0) + 0.5 + "%");
        datum.attr("x",(d) => x(d.x0) + "%").attr("y",(d) => y(d.y0) + 1 + "%")
    };

    // text 중에 숫자 위치
    const textPositionNumber = (datum) => {
        datum.attr("x", (d) => x(d.x1) - this.getComputedTextLength() + "%").attr("y", (d) => y(d.y1) + "%")
    };

    // 사각형 분포
    const rectangluar = (rect) => {
        rect.attr("x", (d) => x(d.x0) + "%")
        .attr("y", (d) => y(d.y0) + "%")
        .attr("width", (d) => {
            var w = x(d.x1) - x(d.x0);
            return w + "%";
        })
        .attr("height", (d) => {
            var h = y(d.y1) - y(d.y0);
            return h + "%";
        })
    };

    // chart name chartBar에 노출
    const chartName = (datum) => datum.parent ? chartName(datum.parent) +  " / " + datum.data.shortName + " (" +
          formatNumber(datum.value) + ")" : datum.data.shortName + " (" + formatNumber(datum.value) + ")";

    valueChartInit();
})();
