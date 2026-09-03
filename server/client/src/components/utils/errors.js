export const ERROR_CODES = {
    400: {
        code: 400,
        name: "BAD_REQUEST",
        title: "Bad Request",
        message: "The request could not be processed.",
        status: "BAD REQUEST",
        description: "The server could not understand or process the request because one or more values were invalid, missing, or incorrectly formatted."
    },

    401: {
        code: 401,
        name: "UNAUTHORISED",
        title: "Unauthorised",
        message: "Authentication is required to access this resource.",
        status: "UNAUTHORISED",
        description: "The request could not be completed because valid authentication credentials were not provided or are no longer valid."
    },

    403: {
        code: 403,
        name: "FORBIDDEN",
        title: "Forbidden",
        message: "You do not have permission to access this resource.",
        status: "FORBIDDEN",
        description: "The server understood the request but refused to fulfil it because the current user or client does not have sufficient permissions."
    },

    404: {
        code: 404,
        name: "NOT_FOUND",
        title: "Not Found",
        message: "The requested resource could not be found.",
        status: "NOT FOUND",
        description: "The requested resource does not exist at the specified location or is not currently available."
    },

    500: {
        code: 500,
        name: "INTERNAL_SERVER_ERROR",
        title: "Internal Server Error",
        message: "The server encountered an unexpected condition that prevented it from fulfilling the request.",
        status: "SERVER ERROR",
        description: "Something went wrong on the server while processing the request."
    }
}

export const CLIENT_ERRORS = {
    REACT_RENDER_ERROR: {
        code: "REACT_RENDER_ERROR",
        title: "Internal React Rendering Error",
        message: "The React rendering process encountered an unexpected error.",
        status: "RENDER ERROR",
        description: "Something went wrong while rendering the React application."
    },

    API_RESPONSE_ERROR: {
        code: "API_RESPONSE_ERROR",
        title: "API Response Error",
        message: "The API returned an unexpected or malformed response.",
        status: "API ERROR",
        description: "The client could not parse or understand the server's response."
    },

    NETWORK_ERROR: {
        code: "NETWORK_ERROR",
        title: "Network Error",
        message: "A network issue prevented the request from completing.",
        status: "NETWORK FAILURE",
        description: "The client could not reach the server due to connectivity issues."
    },

    UNKNOWN_ERROR: {
        code: "UNKNOWN_ERROR",
        title: "Unknown Error",
        message: "An unexpected error occurred.",
        status: "UNKNOWN",
        description: "An unhandled or unidentified error occurred in the application."
    }
}