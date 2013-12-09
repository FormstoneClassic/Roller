/*
 * Roller Plugin [Formtone Library]
 * @author Ben Plum
 * @version 1.2.4
 *
 * Copyright © 2013 Ben Plum <mr@benplum.com>
 * Released under the MIT License <http://www.opensource.org/licenses/mit-license.php>
 */

if (jQuery) (function($) {
	var guid = 0;
	
	// Default Options
	var options = {
		auto: false,
		autoTime: 8000,
		callback: $.noop,
		customClass: "",
		duration: 510,
		debounce: 10,
		initOnload: true,
		minWidth: 0,
		paged: false,
		single: false,
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
		jump: function(index) {
			return $(this).each(function() {
				var data = $(this).data("roller");
				_clearTimer(data.autoTimer);
				_updateItems(data, index-1);
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
				$viewport: $roller.find(".roller-viewport").eq(0),
				$canister: $roller.find(".roller-canister").eq(0),
				$captions: $roller.find(".roller-captions").eq(0),
				$controls: $roller.find(".roller-controls").eq(0),
				$pagination: $roller.find(".roller-pagination").eq(0),
				index: 0,
				deltaX: null,
				deltaY: null,
				leftPosition: 0,
				xStart: 0,
				yStart: 0,
				guid: guid++,
				minWidth: parseInt($roller.data("roller-min-width"), 10) || opts.minWidth,
				// maxWidth: 
				// minWidth: 
				enabled: false,
				touchstart: 0,
				touchEnd: 0
			}, opts);
			
			data.$items = data.$canister.children(".roller-item");
			data.$captionItems = data.$captions.find(".roller-caption");
			data.$controlItems = data.$controls.find(".roller-control");
			data.$paginationItems = data.$pagination.find(".roller-page");
			data.$images = data.$canister.find("img");
			
			data.totalImages = data.$images.length;
			
			$roller.data("roller", data)
				   .on("respond.roller", data, _respond);
			
			if (data.initOnload) {
				pub.enable.apply(data.$roller);
			}
			
			// Rubberband support??
			//$(window).on("snap", data, _respond);
			
			if (data.auto) {
				data.autoTimer = _startTimer(data.autoTimer, data.autoTime, function() { 
					_autoAdvance(data);
				}, true);
			}
			
			if (data.totalImages > 0) {
				data.loadedImages = 0;
				for (var i = 0; i < data.totalImages; i++) {
					var $img = data.$images.eq(i);
					$img.one("load.roller", data, _onImageLoad);
					if ($img[0].complete || $img[0].height) {
						$img.trigger("load.roller");
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
	}
	
	// Handle touch start
	function _touchStart(e) {
		e.stopPropagation();
		
		var data = e.data;
		
		_clearTimer(data.autoTimer);
		
		data.touchStart = new Date().getTime();
		data.$canister.css(_transition("none"));
		
		var touch = (typeof e.originalEvent.targetTouches !== "undefined") ? e.originalEvent.targetTouches[0] : null;
		data.xStart = (touch) ? touch.pageX : e.clientX;
		data.yStart = (touch) ? touch.pageY : e.clientY;
		
		data.$canister.on("touchmove.roller", data, _touchMove)
					  .one("touchend.roller touchcancel.roller", data, _touchEnd);
	}
	
	// Handle touch move
	function _touchMove(e) {
		e.stopPropagation();
		
		var data = e.data,
			touch = (typeof e.originalEvent.targetTouches !== "undefined") ? e.originalEvent.targetTouches[0] : null;
		
		data.deltaX = data.xStart - ((touch) ? touch.pageX : e.clientX);
		data.deltaY = data.yStart - ((touch) ? touch.pageY : e.clientY);
		
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
		var data = e.data;
		
		data.touchEnd = new Date().getTime();
		data.leftPosition = data.touchLeft;
		data.$canister.css(_transition(""));
		
		data.$canister.off("touchmove.roller touchend.roller touchcancel.roller");
		
		var index = _calculateIndex(data);
		
		if (data.touchPaged && !data.swipe) {
			_updateItems(data, index);
		} else {
			data.index = index;
			_updateControls(data);
		}
		data.deltaX = null;
		data.touchStart = 0;
		data.touchEnd = 0;
	}
	
	// Auto adavance
	function _autoAdvance(data) {
		var index = data.index + 1;
		if (index > data.pageCount) {
			index = 0;
		}
		_updateItems(data, index);
	}
	
	// Adavance
	function _advance(e) {
		e.preventDefault();
		e.stopPropagation();
		
		var data = e.data;
		_clearTimer(data.autoTimer);
		
		var index = data.index + (($(e.currentTarget).hasClass("next")) ? 1 : -1);
		_updateItems(data, index);
	}
	
	// Select
	function _select(e) {
		e.preventDefault();
		e.stopPropagation();
		
		var data = e.data,
			index = data.$paginationItems.index($(e.currentTarget));
		
		_clearTimer(data.autoTimer);
		_updateItems(data, index);
	}
	
	// Update
	function _updateItems(data, index) {
		if (index < 0) {
			index = 0;
		}
		if (index > data.pageCount) {
			index = data.pageCount;
		}
		
		if (data.single) {
			data.$items.removeClass("active")
					   .eq(index)
					   .addClass("active");
		} else {
			if (data.paged) {
				var offset = data.$items.eq(index).position();
				if (offset) {
					data.leftPosition = -offset.left;
				}
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
		}
		
		data.index = index;
		
		data.callback.call(data.$roller, data.index);
		
		_updateControls(data);
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
			data.$controlItems.removeClass("enabled");
		} else {
			data.$controlItems.addClass("enabled");
			if (data.index <= 0) {
				data.$controlItems.filter(".previous").removeClass("enabled");
			} else if (data.index >= data.pageCount || data.leftPosition == data.maxMove) {
				data.$controlItems.filter(".next").removeClass("enabled");
			}
		}
	}
	
	// Handle resize
	function _resize(e) {
		var data = e.data;
		
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
		
		_updateItems(data, _calculateIndex(data));
		
		data.$roller.trigger("ready.roller");
		
		return data.$roller;
	}
	
	// Handle reset
	function _reset(e) {
		var data = e.data;
		data.$items = data.$roller.find(".roller-item");
		
		_resize({ data: data });
	}
	
	// Handle respond
	function _respond(e, width) {
		var data = e.data;
		if (data) {
			if (width > data.minWidth) {
				pub.enable.apply(data.$roller);
				
				_resize({ data: data });
			} else {
				pub.disable.apply(data.$roller);
			}
		}
	}
	
	// Return New Index
	function _calculateIndex(data) {
		if (data.single) {
			return data.index;
		} if ((data.deltaX > 20 || data.deltaX < -20) && (data.touchStart && data.touchEnd) && data.touchEnd - data.touchStart < 200) {
			// Swipe
			return data.index + ((data.deltaX > 0) ? 1 : -1);
		} else if (data.paged) {
			// Find page
			var goal = Infinity;
			if (data.leftPosition == data.maxMove) {
				return data.$items.length - 1;
			} else {
				var index = 0;
				data.$items.each(function(i) {
					var offset = $(this).position(),
						check = offset.left + data.leftPosition;
					
					if (check < 0) {
						check = -check;
					}
					
					if (check < goal) {
						goal = check;
						index = i;
					}
				});
				return index;
			}
		} else {
			// Free scrolling
			return Math.round( -data.leftPosition / data.viewportWidth);
		}
	}
	
	// Return translation values
	function _translate3D(value) {
		return { 
			"-webkit-transform": "translate3d(" + value + "px, 0, 0)",
			   "-moz-transform": "translate3d(" + value + "px, 0, 0)",
			    "-ms-transform": "translate3d(" + value + "px, 0, 0)",
			     "-o-transform": "translate3d(" + value + "px, 0, 0)",
			        "transform": "translate3d(" + value + "px, 0, 0)"
		};
	}
	
	// Return transition values
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
	function _startTimer(timer, time, func, interval) {
		_clearTimer(timer, interval);
		if (interval === true) {
			return setInterval(func, time);
		} else {
			return setTimeout(func, time);
		}
	}
	
	// Clear timer
	function _clearTimer(timer) {
		if (timer != null) {
			clearInterval(timer);
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