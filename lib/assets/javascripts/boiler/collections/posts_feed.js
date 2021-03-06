Boiler.Collections.PostsFeed = Marbles.Collection.createClass({
	displayName: 'Boiler.Collection.PostsFeed',

	mixins: [{
		ctor: {
			collectionName: 'posts_feed',

			findOrInit: function (options) {
				var _instance = this.find({
					entity: Boiler.current_entity,
					context: JSON.stringify(options.params || {})
				}, {fetch:false});

				if (!_instance) {
					_instance = new this(options);
				}

				return _instance;
			},

			// Prevent this.find() from throwing an error
			fetch: function () {
				return;
			}
		}
	}],

	willInitialize: function (options) {
		this.params = options.params || {};
		this.context = JSON.stringify(this.params);
		this.client = Boiler.client;

		this.pages = {};

		var _handleChangeTimeout;
		function handleChange () {
			clearTimeout(_handleChangeTimeout);
			_handleChangeTimeout = setTimeout(function () {
				this.trigger('change', this.models());
			}.bind(this), 20);
		}

		this.constructor.model.on('change', handleChange, this);

		this.on('reset', handleChange, this);
		this.on('append', handleChange, this);
		this.on('prepend', handleChange, this);
		this.on('remove', handleChange, this);
	},

	didInitialize: function () {
		this.options.unique = true;
	},

	fetch: function (options) {
		if (!options) {
			options = {};
		}
		var params = Marbles.Utils.extend({}, options.params || {}, this.params);

		var successFn = function (res, xhr) {
			this.handleFetchSuccess(res, xhr, options);
		}.bind(this);

		var failureFn = function (res, xhr) {
			this.handleFetchFailure(res, xhr, options);
		}.bind(this);

		this.client.getPostsFeed({
			params: [params],
			callback: {
				success: successFn,
				failure: failureFn
			}
		});
	},

	fetchPrev: function (options) {
		var params;
		if (this.pages.prev) {
			params = Marbles.History.prototype.deserializeParams(this.pages.prev)[0];
		} else {
			var latest = this.first();
			params = {
				since: latest ? latest.received_at +' '+ latest.get('version.id') : Date.now()
			}
		}
		this.fetch(Marbles.Utils.extend({
			params: params
		}, options || {}));
	},

	fetchNext: function (options) {
		if (!this.pages.next) {
			return false;
		}

		var params = Marbles.History.prototype.deserializeParams(this.pages.next)[0];
		this.fetch(Marbles.Utils.extend({
			params: params
		}, options || {}));
	},

	handleFetchSuccess: function (res, xhr, options) {
		var posts = res.posts,
				pages = res.pages,
				models;
		if (options.prepend) {
			models = this.prependJSON(posts);
		} else if (options.append) {
			models = this.appendJSON(posts);
		} else {
			models = this.resetJSON(posts);
		}

		if (options.prepend && pages.prev) {
			this.pages.prev = pages.prev;
			this.pages.first = pages.first || this.pages.first;
		} else {
			if (pages.next) {
				this.pages.next = pages.next;
			} else {
				delete this.pages.next;
			}
			this.pages.first = pages.last || this.pages.last;
		}

		if (options.callback) {
			if (typeof options.callback === 'function') {
				options.callback(models, res, xhr);
			} else {
				if (typeof options.callback.success === 'function') {
					options.callback.success(models, res, xhr);
				}
			}
		}
	},

	handleFetchFailure: function (res, xhr, options) {
		if (options.callback) {
			if (typeof options.callback === 'function') {
				options.callback([], res, xhr);
			} else {
				if (typeof options.callback.failure === 'function') {
					options.callback.failure(res, xhr);
				}
			}
		}
	}
});
