module.exports = async function (context) {

    const userId =
        context.req.headers["x-appwrite-user-id"];

    if (!userId) {

        context.error(
            "No authenticated Appwrite user ID was provided."
        );

        return context.res.json(
            {
                success: false,
                message: "Authentication required."
            },
            401
        );
    }

    context.log(
        "Authenticated user ID: " +
        userId
    );

    const endpoint =
        context.req.headers["x-appwrite-user-jwt"]
            ? process.env.APPWRITE_FUNCTION_API_ENDPOINT
            : process.env.APPWRITE_FUNCTION_API_ENDPOINT;

    const projectId =
        process.env.APPWRITE_FUNCTION_PROJECT_ID;

    const apiKey =
        process.env.APPWRITE_FUNCTION_API_KEY;

    const databaseId =
        "6abb1e6a003a48902765";

    const tableId =
        "6abb1c93001ce3a10d64";

    if (!apiKey) {

        context.error(
            "APPWRITE_FUNCTION_API_KEY is missing."
        );

        return context.res.json(
            {
                success: false,
                message: "Function API key is missing."
            },
            500
        );
    }

    try {

        const response =
            await fetch(
                endpoint +
                "/databases/" +
                databaseId +
                "/tables/" +
                tableId +
                "/rows",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "X-Appwrite-Project": projectId,
                        "X-Appwrite-Key": apiKey
                    },

                    body: JSON.stringify({

                        rowId: userId,

                        data: {

                            userId: userId,

                            coinBalance: 150,

                            lifetimeEarned: 0,

                            totalSpent: 0,

                            streakDay: 0,

                            scratchCards: 2,

                            wheelSpins: 3,

                            quizAvailable: true

                        },

                        permissions: [
                            "read(\"user:" + userId + "\")"
                        ]

                    })
                }
            );

        const responseText =
            await response.text();

        context.log(
            "TablesDB response status: " +
            response.status
        );

        if (!response.ok) {

            context.error(
                "TablesDB row creation failed: " +
                response.status +
                " " +
                responseText
            );

            return context.res.json(
                {
                    success: false,
                    message:
                        "Could not create Learnpidia user data."
                },
                500
            );
        }

        context.log(
            "Learnpidia user row created successfully."
        );

        return context.res.json(
            {
                success: true,
                message:
                    "Learnpidia user data created successfully."
            }
        );

    } catch (error) {

        context.error(
            "Function error: " +
            (error.message || error)
        );

        return context.res.json(
            {
                success: false,
                message:
                    error.message ||
                    "User data creation failed."
            },
            500
        );
    }
};
