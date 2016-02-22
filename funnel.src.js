/**
 * @license 
 * Highcharts funnel module
 *
 * (c) 2010-2016 Torstein Honsi
 *
 * License: www.highcharts.com/license
 */
/* eslint indent:0 */
(function (factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory;
    } else {
        factory(Highcharts);
    }
}(function (Highcharts) {
	
'use strict';

// create shortcuts
var defaultOptions = Highcharts.getOptions(),
	defaultPlotOptions = defaultOptions.plotOptions,
	seriesTypes = Highcharts.seriesTypes,
	merge = Highcharts.merge,
	noop = function () {},
	each = Highcharts.each,
	pick = Highcharts.pick;

// set default options
defaultPlotOptions.funnel = merge(defaultPlotOptions.pie, {
	animation: false,
	center: ['50%', '50%'],
	width: '90%',
	neckWidth: '30%',
	height: '100%',
	neckHeight: '25%',
	reversed: false,
	dataLabels: {
		//position: 'right',
		connectorWidth: 1,
		connectorColor: '#606060'
	},
	size: true, // to avoid adapting to data label size in Pie.drawDataLabels
	states: {
		select: {
			color: '#C0C0C0',
			borderColor: '#000000',
			shadow: false
		}
	}	
});


seriesTypes.funnel = Highcharts.extendClass(seriesTypes.pie, {
	
	type: 'funnel',
	animate: noop,

	/**
	 * Overrides the pie translate method
	 */
	translate: function () {
		
		var 
			// Get positions - either an integer or a percentage string must be given
			getLength = function (length, relativeTo) {
				return (/%$/).test(length) ?
					relativeTo * parseInt(length, 10) / 100 :
					parseInt(length, 10);
			},
			
			sum = 0,
			series = this,
			chart = series.chart,
			options = series.options,
			reversed = options.reversed,
			ignoreHiddenPoint = options.ignoreHiddenPoint,
			plotWidth = chart.plotWidth,
			plotHeight = chart.plotHeight,
			cumulative = 0, // start at top
			center = options.center,
			centerX = getLength(center[0], plotWidth),
			centerY = getLength(center[1], plotHeight),
			width = getLength(options.width, plotWidth),
			tempWidth,
			getWidthAt,
			height = getLength(options.height, plotHeight),
			neckWidth = getLength(options.neckWidth, plotWidth),
			neckHeight = getLength(options.neckHeight, plotHeight),
			neckY = (centerY - height / 2) + height - neckHeight,
			data = series.data,
			path,
			fraction,
			half = options.dataLabels.position === 'left' ? 1 : 0,
			dataLength = options.dataLength,

			x1, 
			y1, 
			x2,
			x3,
			y3,
			x4, 
			y5;

		alert("dataLength:" + dataLength);
		// Return the width at a specific y coordinate
		series.getWidthAt = getWidthAt = function (y) {
			var top = (centerY - height / 2);
			
			return y > neckY || height === neckHeight ?
				neckWidth :
				neckWidth + (width - neckWidth) * (1 - (y - top) / (height - neckHeight));
		};
		series.getX = function (y, half) {
			return centerX + (half ? -1 : 1) * ((getWidthAt(reversed ? plotHeight - y : y) / 2) + options.dataLabels.distance);
		};

		// Expose
		series.center = [centerX, centerY, height];
		series.centerX = centerX;

		/*
		 * Individual point coordinate naming:
		 *
		 * x1,y1 _________________ x2,y1
		 *  \                         /
		 *   \                       /
		 *    \                     /
		 *     \                   /
		 *      \                 /
		 *     x3,y3 _________ x4,y3
		 *
		 * Additional for the base of the neck:
		 *
		 *       |               |
		 *       |               |
		 *       |               |
		 *     x3,y5 _________ x4,y5
		 */




		// get the total sum
		each(data, function (point, i) {
			if(i < dataLength)
			if (!ignoreHiddenPoint || point.visible !== false) {
				sum += point.y;
			}
		});

		each(data, function (point, j) {
			if(j < dataLength) {
				// set start and end positions
				y5 = null;
				fraction = sum ? point.y / sum : 0;
				y1 = centerY - height / 2 + cumulative * height;
				y3 = y1 + fraction * height;
				//tempWidth = neckWidth + (width - neckWidth) * ((height - neckHeight - y1) / (height - neckHeight));
				tempWidth = getWidthAt(y1);
				x1 = centerX - tempWidth / 2;
				x2 = x1 + tempWidth;
				tempWidth = getWidthAt(y3);
				x3 = centerX - tempWidth / 2;
				x4 = x3 + tempWidth;

				// the entire point is within the neck
				if (y1 > neckY) {
					x1 = x3 = centerX - neckWidth / 2;
					x2 = x4 = centerX + neckWidth / 2;

					// the base of the neck
				} else if (y3 > neckY) {
					y5 = y3;

					tempWidth = getWidthAt(neckY);
					x3 = centerX - tempWidth / 2;
					x4 = x3 + tempWidth;

					y3 = neckY;
				}

				if (reversed) {
					y1 = height - y1;
					y3 = height - y3;
					y5 = (y5 ? height - y5 : null);
				}
				// save the path
				path = [
					'M',
					x1, y1,
					'L',
					x2, y1,
					x4, y3
				];
				if (y5) {
					path.push(x4, y5, x3, y5);
				}
				path.push(x3, y3, 'Z');

				// prepare for using shared dr
				point.shapeType = 'path';
				point.shapeArgs = {d: path};
				point.path = path;

				point.y1= y1;
				point.y3=y3;
				point.y5=y5;
				point.x4 = x4;
				point.x3 = x3;


				// for tooltips and data labels
				point.percentage = fraction * 100;
				point.plotX = centerX;
				point.plotY = (y1 + (y5 || y3)) / 2;

				// Placement of tooltips and data labels
				point.tooltipPos = [
					centerX,
					point.plotY
				];

				// Slice is a noop on funnel points
				point.slice = noop;

				// Mimicking pie data label placement logic
				point.half = half;

				if (!ignoreHiddenPoint || point.visible !== false) {
					cumulative += fraction;
				}
			}
		});		
	},
	/**
	 * Draw a single point (wedge)
	 * @param {Object} point The point object
	 * @param {Object} color The color of the point
	 * @param {Number} brightness The brightness relative to the color
	 */
	drawPoints: function () {
		var series = this,
			options = series.options,
			chart = series.chart,
			renderer = chart.renderer,
			pointOptions,
			pointAttr,
			shapeArgs,
			graphic,
			dataLength=options.dataLength;


		each(series.data, function (point, i) {

			if(i < dataLength) {
				pointOptions = point.options;
				graphic = point.graphic;
				shapeArgs = point.shapeArgs;

				pointAttr = {
					fill: point.color,
					stroke: pick(pointOptions.borderColor, options.borderColor),
					'stroke-width': pick(pointOptions.borderWidth, options.borderWidth)
				};

				if (!graphic) { // Create the shapes
					point.graphic = renderer.path(shapeArgs)
						.attr(pointAttr)
						.add(series.group);

				} else { // Update the shapes
					graphic.attr(pointAttr).animate(shapeArgs);
				}
			}
		});
	},
	/**
	 * Funnel items don't have angles (#2289)
	 */
	sortByAngle: function (points) {
		points.sort(function (a, b) {
			return a.plotY - b.plotY;
		});
	},
	/**
	 * Extend the pie data label method
	 */
	drawDataLabels: function () {
		var data = this.data,
			labelDistance = this.options.dataLabels.distance,
			leftSide,
			sign,
			point,
			i = data.length,
			x,
			y;

		var series = this,
			dataLength = series.options.dataLength;
		//alert("while:"+ dataLength);
		// In the original pie label anticollision logic, the slots are distributed
		// from one labelDistance above to one labelDistance below the pie. In funnels
		// we don't want this.
		this.center[2] -= 2 * labelDistance;
		// Set the label position array for each point.

		i = dataLength;
		//alert("i=" + i);
		var s = 5;

		while (i--) {
			point = data[i];
			leftSide = point.half;
			sign = leftSide ? 1 : -1;
			point.plotY= point.y1;
			y = point.plotY;
			x = this.getX(y, leftSide);

			// set the anchor point for data labels
			point.labelPos = [
				0, // first break of connector
				y, // a/a
				x + (labelDistance - 5) * sign, // second break, right outside point shape
				y, // a/a
				x + labelDistance * sign, // landing point for connector
				y, // a/a
				leftSide ? 'right' : 'left', // alignment
				0 // center angle
			];
		}


		/**

		data[dataLength].shapeArgs= data[dataLength - 1].shapeArgs;
		data[dataLength].shapeType = data[dataLength - 1].shapeType;
		data[dataLength].percentage = data[dataLength - 1].percentage;
		data[dataLength].plotX = data[dataLength - 1].plotX;
		data[dataLength].slice = data[dataLength - 1].slice;
		data[dataLength].plotY = data[dataLength - 1].y3 || data[dataLength - 1].y5;
		data[dataLength].half = data[dataLength - 1].half;



		leftSide = data[dataLength].half;
		sign = leftSide ? 1 : -1;
		y = data[dataLength].plotY;
		x = this.getX(y, leftSide);
		data[dataLength].labelPos = [
			0, // first break of connector
			y, // a/a
			x + (labelDistance - 5) * sign, // second break, right outside point shape
			y, // a/a
			x + labelDistance * sign, // landing point for connector
			y, // a/a
			leftSide ? 'right' : 'left', // alignment
			0 // center angle
		];
**/
		var j ;
		for(var k = dataLength, index = 0; k < data.length; k++,index++) {

			j = index;

			if(k == dataLength){

				j = dataLength - 1;
				//alert("ssss:"  + ss);
				data[k].half = data[j].half;
				data[k].plotY = data[j].y3 || data[j].y5;
				--index;
			}else {

				data[k].half = 1;
				data[k].plotY = (data[j].y1 + (data[j].y3 || data[j].y5))/2;
			}
			data[k].shapeArgs = data[j].shapeArgs;
			data[k].shapeType = data[j].shapeType;
			data[k].percentage = data[j].percentage;
			data[k].plotX = data[j].plotX;
			data[k].slice = data[j].slice;


			leftSide = data[k].half;
			sign = leftSide ? 1 : -1;
			y = data[k].plotY;
			x = this.getX(y, leftSide);
			data[k].labelPos = [
				0, // first break of connector
				y, // a/a
				x + (labelDistance - 5) * sign, // second break, right outside point shape
				y, // a/a
				x + labelDistance * sign, // landing point for connector
				y, // a/a
				leftSide ? 'right' : 'left',, // alignment
				0 // center angle
			];
		}

		seriesTypes.pie.prototype.drawDataLabels.call(this);


	}

});

/** 
 * Pyramid series type.
 * A pyramid series is a special type of funnel, without neck and reversed by default.
 */
defaultOptions.plotOptions.pyramid = Highcharts.merge(defaultOptions.plotOptions.funnel, {        
	neckWidth: '0%',
	neckHeight: '0%',
	reversed: true
});
Highcharts.seriesTypes.pyramid = Highcharts.extendClass(Highcharts.seriesTypes.funnel, {
	type: 'pyramid'
});

}));
