/*
 * Roller Plugin [Formtone Library]
 * @author Ben Plum
 * @version 0.0.7
 *
 * Copyright © 2013 Ben Plum <mr@benplum.com>
 * Released under the MIT License <http://www.opensource.org/licenses/mit-license.php>
 */

if (jQuery) (function($) {
	var guidCount = 0;
	
	// Default Options
	var options = {
		autoTime: 8000,
		auto: false,
		customClass: "",
		duration: 500,
		paged: false,
		useMargin: false
	};
	
	// Public Methods
	var pub = {
		
		// Set Defaults
		defaults: function(opts) {
			options = $.extend(options, opts || {});
			return $(this);
		},
		
		// Disable instance
		disable: function(data) {
			if (data.enabled) {
				_clearTimer(data.autoTimer);
				
				data.$roller.removeClass("roller roller-initialized")
							.off("click.roller")
							.off("click.roller")
							.off("resize.roller")
							.off("reset.roller")
							.off("touchstart.roller");
				
				data.$pagination.html("");
				
				if (data.useMargin) {
					data.$canister.css({ marginLeft: "0" });
				} else {
					data.$canister.css({ transform: "translate3D(0,0,0)" });
				}
				data.index = 0;
			}
			data.enabled = false;
		},
		
		// Enable instance
		enable: function(data) {
			if (!data.enabled) {
				data.$roller.data("roller", data)
							.addClass("roller")
							.on("click.roller", ".roller-control", _advance)
							.on("click.roller", ".roller-page", _select)
							.on("resize.roller", data, pub.resize)
							.on("reset.roller", data, pub.reset)
							.on("respond.roller", data, pub.respond)
							.on("touchstart.roller", data, _touchStart)
						 	.trigger("resize.roller");
			}
			data.enabled = true;
		},
		
		// Manual jump
		jump: function(data, index, animated) {
			_position(data, index, animated || true);
		},
		
		// Manual resize
		resize: function(e) {
			var data = $(e.delegateTarget).data("roller");
			
			data.autoTimer = _startTimer(data.autoTimer, Site.debounceTime, function() { _resize(data); });
		},
		
		// Manual reset (if items change)
		reset: function(e) {
			var data = $(e.delegateTarget).data("roller");
			data.$itemsAll = data.$roller.find(".roller_item");
			data.$items = data.$allItems.filter(":visible");
			data.$roller.trigger("resize.roller");
			_position(data, data.index, false);
		},
		
		// Manual respond (for breakpoints)
		respond: function(e) {
			var data = $(e.delegateTarget).data("roller");
			
			if (data.breakWidth >= Site.minWidth) {
				pub.enable(data);
			} else {
				pub.disable(data);
			}
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
				breakWidth: parseInt($roller.data("max-width")) || Infinity,
				enabled: false
			}, opts);
			
			data.totalImages = data.$images.length;
			
			pub.enable(data);
			
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
		data.$roller.data("roller", data);
	}
	
	// Handle touch start
	function _touchStart(e) {
		var data = e.data;
		
		if ($(e.target).hasClass("roller-control") || $(e.target).hasClass("roller-page")) {
			return;
		}
		
		_clearTimer(data.autoTimer);
		
		data.startTime = new Date().getTime();
		data.startEvent = e;
		
		if (!data.isAnimating) {
			var touch = (typeof e.originalEvent.targetTouches !== "undefined") ? e.originalEvent.targetTouches[0] : null;
			data.xStart = (touch) ? touch.pageX : e.clientX;
			data.yStart = (touch) ? touch.pageY : e.clientY;
			Site.$window.on("touchmove.roller", data, _touchMove)
						.one("touchend.roller", data, _touchEnd)
						.one("touchcancel.roller", data, _touchEnd);
		}
	}
	
	// Handle touch move
	function _touchMove(e) {
		var data = e.data,
			touch = (typeof e.originalEvent.targetTouches !== "undefined") ? e.originalEvent.targetTouches[0] : null;
		
		data.deltaX = data.xStart - ((touch) ? touch.pageX : e.clientX);
		data.deltaY = data.yStart - ((touch) ? touch.pageY : e.clientY);
		
		// Only prevent event if trying to swipe
		data.deltaXCheck = (data.deltaX < 0) ? -data.deltaX : data.deltaX;
		data.deltaYCheck = (data.deltaY < 0) ? -data.deltaY : data.deltaY;
		
		if (data.deltaYCheck < 20 && data.startEvent) {
			data.startEvent.preventDefault();
			data.startEvent.stopPropagation();
			data.startEvent = null;
		}
		if (data.deltaXCheck > 10) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		var newLeft = data.leftPosition - data.deltaX;
		if (newLeft > 0) {
			newLeft = 0;
		}
		if (newLeft < data.maxMove) {
			newLeft = data.maxMove;
		}
		
		if (data.useMargin) {
			data.$canister.css({ marginLeft: newLeft });
		} else {
			data.$canister.css({ transform: "translate3D("+newLeft+"px,0,0)" });
		}
	}
	
	// Handle touch end
	function _touchEnd(e) {
		var data = e.data,
			edge = data.viewportWidth * 0.25,
			index = data.index;
		
		data.endTime = new Date().getTime();
		
		if (data.endTime - data.startTime > 200 && (data.deltaXCheck > 20 || data.deltaYCheck > 20)) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		data.startEvent = null;
		
		Site.$window.off("touchmove.roller")
					.off("touchend.roller")
					.off("touchcancle.roller");
		
		if (data.deltaX) {
			if (data.deltaX > edge || data.deltaX < -edge) {
				index = data.index + (((data.leftPosition - data.deltaX) <= data.leftPosition) ? 1 : -1);
			}
			
			_position(data, index, true);
			data.deltaX = null;
		}
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
		
		var data = $(e.delegateTarget).data("roller");
		_clearTimer(data.autoTimer);
		
		if (!data.isAnimating) {
			var index = data.index + (($(e.currentTarget).hasClass("next")) ? 1 : -1);
			_position(data, index, true);
		}
	}
	
	// Select / Jump
	function _select(e) {
		e.preventDefault();
		e.stopPropagation();
		
		var data = $(e.delegateTarget).data("roller");
		var index = data.$paginationItems.index($(e.currentTarget));
		_clearTimer(data.autoTimer);
		
		_position(data, index, true);
	}
	
	// Position canister
	function _position(data, index, animate) {
		if (animate) {
			data.isAnimating = true;
			data.$roller.addClass("animated");
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
			data.$canister.css({ transform: "translate3D("+data.leftPosition+"px,0,0)" });
		}
		
		data.$captionItems.filter(".active").removeClass("active");
		data.$captionItems.eq(index).addClass("active");
		
		data.$paginationItems.filter(".active").removeClass("active");
		data.$paginationItems.eq(index).addClass("active");
		
		// Item callback?
		//Site._removeVideo(data.$items.filter(".video_active"));
		
		data.$items.removeClass("visible");
		if (data.perPage != "Infinity") {
			for (var i = 0; i < data.perPage; i++) {
				if (data.leftPosition == data.maxMove) {
					data.$items.eq(data.count - 1 - i).addClass("visible");
				} else {
					data.$items.eq((data.perPage * index) + i).addClass("visible");
				}
			}
		}
		
		data.index = index;
		data.$roller.data("roller", data);
		
		_updateControls(data);
		
		if (animate) {
			_startTimer(data.autoTimer, data.duration, function() {
				data.isAnimating = false;
				data.$roller.removeClass("animated");
			});
		}
	}
	
	// Update controls / arrows
	function _updateControls(data) {
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
	function _resize(data) {
		data.$roller.addClass("roller-initialized");
		
		data.count = data.$items.length;
		data.viewportWidth = (data.$viewport.length > 0) ? data.$viewport.outerWidth(true) : data.$roller.outerWidth(true);
		
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
		
		var index = -Math.ceil(data.leftPosition / data.viewportWidth);
		_position(data, index, false);
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