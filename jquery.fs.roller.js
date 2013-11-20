/*
 * Roller Plugin [Formtone Library]
 * @author Ben Plum
 * @version 1.2.1
 *
 * Copyright © 2013 Ben Plum <mr@benplum.com>
 * Released under the MIT License <http://www.opensource.org/licenses/mit-license.php>
 */

if (jQuery) (function($) {
	var guidCount = 0,
		$window = $(window);
	
	// Default Options
	var options = {
		autoTime: 8000,
		auto: false,
		breakWidth: 0,
		customClass: "",
		duration: 510,
		debounce: 10,
		initOnload: true,
		paged: false,
		touchPaged: true,
		useMargin: false
	};
	
	// Public Methods
	var pub = {
		
		// Set Defaults
		defaults: function(opts) {
			options = $.extend(options, opts || {});
			return $(this);
		},
		
		// Destroy Roller
		destroy: function() {
			return $(this);
		},
		
		// Disable instance
		disable: function() {
			return $(this).each(function() {
				var data = $(this).data("roller");
				
				if (data.enabled) {
					_clearTimer(data.autoTimer);
					
					data.$roller.removeClass("roller roller-initialized")
								.off("touchstart.roller click.roller resize.roller reset.roller");
					
					data.$canister.css({ width: "" })
								  .off("touchstart.roller");
					
					data.$pagination.html("");
					
					if (data.useMargin) {
						data.$canister.css({ marginLeft: "" });
					} else {
						data.$canister.css(_translate3D(0));
					}
					
					data.index = 0;
				}
				
				data.enabled = false;
			});
		},
		
		// Enable instance
		enable: function() {
			return $(this).each(function() {
				var data = $(this).data("roller");
				
				if (!data.enabled) {
					data.$roller.data("roller", data)
								.addClass("roller")
								.on("touchstart.roller click.roller", ".roller-control", data, _advance)
								.on("touchstart.roller click.roller", ".roller-page", data, _select)
								.on("resize.roller", data, _resize)
								.on("reset.roller", data, _reset)
								.trigger("resize.roller");
					
					data.$canister.on("touchstart.roller", data, _touchStart);
				}
				
				data.enabled = true;
			});
		},
		
		// Jump pages
		jump: function(index, animated) {
			return $(this).each(function() {
				var data = $(this).data("roller");
				_position(data, index-1, (typeof animated != "undefined") ? animated : true);
			});
		}
	};
	
	// Private Methods
	
	// Initialize
	function _init(opts) {
		// Settings
		opts = $.extend({}, options, opts);
		
		// Apply to each element
		var $items = $(this);
		for (var i = 0, count = $items.length; i < count; i++) {
			_build($items.eq(i), opts);
		}
		
		return $items;
	}
	
	// Build
	function _build($roller, opts) {
		if (!$roller.data("roller")) {
			var data = $.extend({}, {
				$roller: $roller,
				$viewport: $roller.find(".roller-viewport"),
				$canister: $roller.find(".roller-canister"),
				$items: $roller.find(".roller-item"),
				$captions: $roller.find(".roller-captions"),
				$captionItems: $roller.find(".roller-caption"),
				$controls: $roller.find(".roller-controls"),
				$controlItems: $roller.find(".roller-control"),
				$pagination: $roller.find(".roller-pagination"),
				$paginationItems: $roller.find(".roller-page"),
				$images: $roller.find("img"),
				isAnimating: false,
				index: -1,
				deltaX: null,
				deltaY: null,
				leftPosition: 0,
				xStart: 0,
				yStart: 0,
				guid: guidCount++,
				breakWidth: parseInt($roller.data("roller-break-width"), 10) || opts.breakWidth,
				enabled: false
			}, opts);
			
			data.totalImages = data.$images.length;
			
			$roller.data("roller", data)
				   .on("respond.roller", data, _respond);
			
			if (data.initOnload) {
				pub.enable.apply(data.$roller);
			}
			
			// Rubberband support??
			//$(window).on("snap", data, _respond);
			
			if (data.auto) {
				data.autoTimer = _startTimer(data.autoTimer, data.autoTime, function() { _autoAdvance(data); });
			}
			
			if (data.totalImages > 0) {
				data.loadedImages = 0;
				for (var i = 0; i < data.totalImages; i++) {
					var $img = data.$images.eq(i);
					$img.one("load", data, _onImageLoad);
					if ($img[0].complete || $img[0].height) {
						$img.trigger("load");
					}
				}
			}
		}
	}
	
	// Handle image load
	function _onImageLoad(e) {
		var data = e.data;
		data.loadedImages++;
		if (data.loadedImages == data.totalImages) {
			data.$roller.trigger("resize.roller");
		}
		//data.$roller.data("roller", data);
	}
	
	// Handle touch start
	function _touchStart(e) {
		e.stopPropagation();
		
		var data = e.data;
		
		if (!data.isAnimating) {
			_clearTimer(data.autoTimer);
			
			data.$canister.css(_transition("none"));
			
			var touch = (typeof e.originalEvent.targetTouches !== "undefined") ? e.originalEvent.targetTouches[0] : null;
			data.xStart = (touch) ? touch.pageX : e.clientX;
			data.yStart = (touch) ? touch.pageY : e.clientY;
			
			$window.on("touchmove.roller", data, _touchMove)
				   .one("touchend.roller touchcancel.roller", data, _touchEnd);
		}
	}
	
	// Handle touch move
	function _touchMove(e) {
		e.stopPropagation();
		
		var data = e.data,
			touch = (typeof e.originalEvent.targetTouches !== "undefined") ? e.originalEvent.targetTouches[0] : null;
		
		data.deltaX = data.xStart - ((touch) ? touch.pageX : e.clientX);
		//data.deltaY = data.yStart - ((touch) ? touch.pageY : e.clientY);
		
		if (data.deltaX < -10 || data.deltaX > 10) {
			e.preventDefault();
		}
		
		data.touchLeft = data.leftPosition - data.deltaX;
		if (data.touchLeft > 0) {
			data.touchLeft = 0;
		}
		if (data.touchLeft < data.maxMove) {
			data.touchLeft = data.maxMove;
		}
		
		if (data.useMargin) {
			data.$canister.css({ marginLeft: data.touchLeft });
		} else {
			data.$canister.css(_translate3D(data.touchLeft));
		}
	}
	
	
	// Handle touch end
	function _touchEnd(e) {
		var data = e.data,
			edge = 25, //data.viewportWidth * 0.1;
			index = data.index;
		
		data.$canister.css(_transition(""));
		
		$window.off("touchmove.roller touchend.roller touchcancel.roller");
		
		if (data.paged) {
			var goal = Infinity;
			if (data.touchLeft == data.maxMove) {
				index = data.$items.length - 1;
			} else {
				data.$items.each(function(i) {
					var offset = $(this).position(),
						check = offset.left + data.touchLeft;
					
					if (check < 0) {
						check = -check;
					}
					
					if (check < goal) {
						goal = check;
						index = i;
					}
				});
			}
		} else {
			index = Math.round( -data.touchLeft / data.viewportWidth);
		}
		
		/*
		if (data.deltaX > edge || data.deltaX < -edge) {
			var index = data.index + (((data.leftPosition - data.deltaX) <= data.leftPosition) ? 1 : -1);
		}
		*/
		
		if (data.touchPaged) {
			_position(data, index, true);
		} else {
			data.leftPosition = data.touchLeft;
			data.index = index;
			_updateControls(data);
		}
		data.deltaX = null;
	}
	
	// Auto adavance
	function _autoAdvance(data) {
		var index = data.index + 1;
		if (index > data.pageCount) {
			index = 0;
		}
		_position(data, index, true);
		_clearTimer(data.autoTimer);
		
		return true;
	}
	
	// Adavance
	function _advance(e) {
		e.preventDefault();
		e.stopPropagation();
		
		var data = e.data;
		_clearTimer(data.autoTimer);
		
		if (!data.isAnimating) {
			var index = data.index + (($(e.currentTarget).hasClass("next")) ? 1 : -1);
			_position(data, index, true);
		}
	}
	
	// Select
	function _select(e) {
		e.preventDefault();
		e.stopPropagation();
		
		var data = e.data,
			index = data.$paginationItems.index($(e.currentTarget));
		_clearTimer(data.autoTimer);
		
		_position(data, index, true);
	}
	
	// Position canister
	function _position(data, index, animate) {
		if (animate) {
			data.isAnimating = true;
		}
		
		if (index < 0) {
			index = 0;
		}
		if (index > data.pageCount) {
			index = data.pageCount;
		}
		
		if (data.paged) {
			var offset = data.$items.eq(index).position();
			data.leftPosition = -offset.left;
		} else {
			data.leftPosition = -(index * data.pageMove);
		}
		
		if (data.leftPosition < data.maxMove) { 
			data.leftPosition = data.maxMove; 
		}
		
		if (data.useMargin) {
			data.$canister.css({ marginLeft: data.leftPosition });
		} else {
			data.$canister.css(_translate3D(data.leftPosition));
		}
		
		data.index = index;
		
		_updateControls(data);
		
		if (animate) {
			_startTimer(data.autoTimer, data.duration, function() {
				data.isAnimating = false;
			});
		}
	}
	
	// Update controls / arrows
	function _updateControls(data) {
		data.$captionItems.filter(".active").removeClass("active");
		data.$captionItems.eq(data.index).addClass("active");
		
		data.$paginationItems.filter(".active").removeClass("active");
		data.$paginationItems.eq(data.index).addClass("active");
		
		data.$items.removeClass("visible");
		if (data.perPage != "Infinity") {
			for (var i = 0; i < data.perPage; i++) {
				if (data.leftPosition == data.maxMove) {
					data.$items.eq(data.count - 1 - i).addClass("visible");
				} else {
					data.$items.eq((data.perPage * data.index) + i).addClass("visible");
				}
			}
		}
		
		if (data.pageCount <= 0) {
			data.$controlItems.addClass("disabled");
		} else {
			data.$controlItems.removeClass("disabled");
			if (data.index <= 0) {
				data.$controlItems.filter(".previous").addClass("disabled");
			} else if (data.index >= data.pageCount || data.leftPosition == data.maxMove) {
				data.$controlItems.filter(".next").addClass("disabled");
			}
		}
	}
	
	// Handle resize
	function _resize(e) {
		var data = e.data;
		data.autoTimer = _startTimer(data.autoTimer, data.debounce, function() { 
			_doResize(data); 
		});
		
		return data.$roller;
	}
	
	// Do resize
	function _doResize(data) {
		data.$roller.addClass("roller-initialized");
		
		data.count = data.$items.length;
		data.viewportWidth = (data.$viewport.length > 0) ? data.$viewport.outerWidth(false) : data.$roller.outerWidth(false);
		
		if (data.paged) {
			data.maxWidth = 0;
			for (var i = 0; i < data.count; i++) {
				data.maxWidth += data.$items.eq(i).outerWidth(false);
			}
			data.perPage = 1;
			data.pageCount = (data.maxWidth > data.viewportWidth) ? data.count - 1 : 0;
		} else {
			data.itemMargin = parseInt(data.$items.eq(0).css("margin-left"), 10) + parseInt(data.$items.eq(0).css("margin-right"), 10);
			data.itemWidth = data.$items.eq(0).outerWidth(false) + data.itemMargin;
			data.perPage = Math.floor(data.viewportWidth / data.itemWidth);
			if (data.perPage < 1) {
				data.perPage = 1;
			}
			data.pageCount = Math.ceil(data.count / data.perPage) - 1;
			data.pageMove = data.itemWidth * data.perPage;
			data.maxWidth = data.itemWidth * data.count;
		}
		
		data.maxMove = -data.maxWidth + data.viewportWidth;
		if (data.maxMove > 0) {
			data.maxMove = 0;
		}
		
		// Reset Page Count
		if (data.pageCount != "Infinity") {
			var html = '';
			for (var i = 0; i <= data.pageCount; i++) {
				html += '<span class="roller-page">' + i + '</span>';
			}
			data.$pagination.html(html);
		}
		if (data.pageCount < 1) {
			data.$controls.removeClass("visible");
			data.$pagination.removeClass("visible");
		} else {
			data.$controls.addClass("visible");
			data.$pagination.addClass("visible");
		}
		data.$paginationItems = data.$roller.find(".roller-page");
		
		data.$canister.css({ width: data.maxWidth });
		
		var index = -Math.ceil(data.leftPosition / data.viewportWidth);
		_position(data, index, false);
	}
	
	// Handle reset
	function _reset(e) {
		var data = e.data;
		data.$items = data.$roller.find(".roller-item");
		
		_doResize(data);
		_position(data, data.index, false);
	}
	
	// Handle respond
	function _respond(e, width) {
		var data = e.data;
		if (width > data.breakWidth) {
			pub.enable.apply(data.$roller);
		} else {
			pub.disable.apply(data.$roller);
		}
	}
	
	function _translate3D(value) {
		return { 
			"-webkit-transform": "translate3d(" + value + "px, 0, 0)",
			   "-moz-transform": "translate3d(" + value + "px, 0, 0)",
			    "-ms-transform": "translate3d(" + value + "px, 0, 0)",
			     "-o-transform": "translate3d(" + value + "px, 0, 0)",
			        "transform": "translate3d(" + value + "px, 0, 0)"
		};
	}
	
	function _transition(value) {
		return {
			"-webkit-transition": value,
			   "-moz-transition": value,
			    "-ms-transition": value,
			     "-o-transition": value,
			        "transition": value
		};
	}
	
	// Start Timer
	function _startTimer(timer, time, func) {
		_clearTimer(timer);
		return setTimeout(func, time);
	}
	
	// Clear timer
	function _clearTimer(timer) {
		if (timer != null) {
			clearTimeout(timer);
			timer = null;
		}
	}
	
	// Define Plugin
	$.fn.roller = function(method) {
		if (pub[method]) {
			return pub[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if (typeof method === 'object' || !method) {
			return _init.apply(this, arguments);
		}
		return this;
	};
})(jQuery);