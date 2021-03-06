(function () {

	var CONTENT_TYPE = 'application/x-www-form-urlencoded';

	Boiler.FormEncodedMiddleware = {
		willSendRequest: function (request) {
			if (request.multipart) {
				return;
			}

			if (!request.requestBody) {
				return;
			}

			var contentType = request.getRequestHeader('Content-Type');
			if (contentType !== CONTENT_TYPE) {
				return;
			}

			var params = request.requestBody;
			if (!Array.isArray(params)) {
				params = [params];
			}
			request.requestBody = Marbles.QueryParams.serializeParams(params).substring(1);
		},

		didReceiveResponse: function (request) {
			var contentType = request.getResponseHeader('Content-Type');
			if (contentType !== CONTENT_TYPE) {
				return;
			}

			var response = request.xhr.response;
			var responseData = null;
			if (!response || typeof response !== 'string') {
				return;
			}

			if (!Array.isArray(responseData)) {
				responseData = [responseData];
			}

			request.responseData = Marbles.QueryParams.deserializeParams(responseData);
		}
	};

})();
