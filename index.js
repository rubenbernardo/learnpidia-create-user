module.exports = async function (context) {

    const userId =
        context.req.headers["x-appwrite-user-id"];

    const apiKey =
        context.req.headers["x-appwrite-key"];

    const endpoint =
        process.env.APPWRITE_FUNCTION_API_ENDPOINT;

    const projectId =
        process.env.APPWRITE_FUNCTION_PROJECT_ID;

    const databaseId =
        "6abb1c93001ce3a10d64";

    const userTableId =
        "6abb1e6a003a48902765";

    const rewardTableId =
        "reward-transactions";


    // =====================================================
    // CHECK AUTHENTICATION
    // =====================================================

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


    // =====================================================
    // CHECK FUNCTION API KEY
    // =====================================================

    if (!apiKey) {

        context.error(
            "No Appwrite Function API key was provided."
        );

        return context.res.json(
            {
                success: false,
                message: "Function API key is missing."
            },
            500
        );
    }


    // =====================================================
    // READ REQUEST
    // =====================================================

    let requestData = {};

    try {

        if (context.req.body) {

            requestData =
                typeof context.req.body === "string"
                    ? JSON.parse(context.req.body)
                    : context.req.body;
        }

    } catch (error) {

        context.error(
            "Invalid JSON request body."
        );

        return context.res.json(
            {
                success: false,
                message: "Invalid request data."
            },
            400
        );
    }


    const operation =
        requestData.operation || "create_user";


    context.log(
        "Learnpidia backend operation: " +
        operation +
        " for user: " +
        userId
    );


    // =====================================================
    // HELPER: APPWRITE REQUEST
    // =====================================================

    async function appwriteRequest(
        path,
        method,
        body
    ) {

        const options = {

            method: method,

            headers: {

                "Content-Type":
                    "application/json",

                "X-Appwrite-Project":
                    projectId,

                "X-Appwrite-Key":
                    apiKey,

                "Accept":
                    "application/json"
            }
        };


        if (body !== undefined) {

            options.body =
                JSON.stringify(body);
        }


        const response =
            await fetch(
                endpoint + path,
                options
            );


        const responseText =
            await response.text();


        let responseData = {};

        try {

            responseData =
                responseText
                    ? JSON.parse(responseText)
                    : {};

        } catch (error) {

            responseData = {
                raw: responseText
            };
        }


        return {

            ok:
                response.ok,

            status:
                response.status,

            data:
                responseData
        };
    }


    // =====================================================
    // OPERATION 1
    // CREATE USER
    // =====================================================

    if (operation === "create_user") {

        context.log(
            "Creating Learnpidia user row for: " +
            userId
        );


        try {

            const response =
                await appwriteRequest(

                    "/tablesdb/" +
                    databaseId +
                    "/tables/" +
                    userTableId +
                    "/rows",

                    "POST",

                    {

                        rowId:
                            userId,

                        data: {

                            userID:
                                userId,

                            coinBalance:
                                150,

                            lifetimeEarned:
                                0,

                            totalSpent:
                                0,

                            streakDay:
                                0,

                            scratchCards:
                                2,

                            wheelSpins:
                                3,

                            quizAvailable:
                                true
                        },

                        permissions: [

                            "read(\"user:" +
                            userId +
                            "\")"
                        ]
                    }
                );


            if (!response.ok) {

                context.error(
                    "Learnpidia user row creation failed: " +
                    response.status +
                    " " +
                    JSON.stringify(
                        response.data
                    )
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

                    operation:
                        "create_user",

                    message:
                        "Learnpidia user data created successfully."
                }
            );


        } catch (error) {

            context.error(
                "Create user error: " +
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
    }


    // =====================================================
    // OPERATION 2
    // REWARD COINS
    // =====================================================

    if (operation === "reward_coins") {

        const rewardType =
            requestData.rewardType;

        const referenceID =
            requestData.referenceID;


        // -------------------------------------------------
        // REQUIRED VALUES
        // -------------------------------------------------

        if (!rewardType || !referenceID) {

            return context.res.json(
                {
                    success: false,

                    message:
                        "rewardType and referenceID are required."
                },
                400
            );
        }


        // -------------------------------------------------
        // SERVER-CONTROLLED REWARD AMOUNTS
        // -------------------------------------------------
        //
        // IMPORTANT:
        // The Android app does NOT send the amount.
        //
        // The server decides the amount.
        //
        // -------------------------------------------------

        const allowedRewards = {

            test_reward:
                10

        };


        if (
            !Object.prototype.hasOwnProperty.call(
                allowedRewards,
                rewardType
            )
        ) {

            context.error(
                "Unknown reward type: " +
                rewardType
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        "This reward type is not available."
                },
                400
            );
        }


        const rewardAmount =
            allowedRewards[rewardType];


        try {

            // -------------------------------------------------
            // CHECK FOR DUPLICATE REFERENCE
            // -------------------------------------------------

            const duplicateQuery =
                "/tablesdb/" +
                databaseId +
                "/tables/" +
                rewardTableId +
                "/rows/" +
                encodeURIComponent(
                    referenceID
                );


            const existingReward =
                await appwriteRequest(
                    duplicateQuery,
                    "GET"
                );


            if (existingReward.ok) {

                return context.res.json(
                    {
                        success: false,

                        message:
                            "This reward has already been claimed."
                    },
                    409
                );
            }


            // -------------------------------------------------
            // GET CURRENT USER BALANCE
            // -------------------------------------------------

            const userRowPath =
                "/tablesdb/" +
                databaseId +
                "/tables/" +
                userTableId +
                "/rows/" +
                encodeURIComponent(
                    userId
                );


            const userResponse =
                await appwriteRequest(
                    userRowPath,
                    "GET"
                );


            if (!userResponse.ok) {

                context.error(
                    "Could not read user row: " +
                    JSON.stringify(
                        userResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not read your Learnpidia balance."
                    },
                    500
                );
            }


            const userRow =
                userResponse.data;


            const currentBalance =
                Number(
                    userRow.coinBalance
                );


            const currentLifetimeEarned =
                Number(
                    userRow.lifetimeEarned || 0
                );


            if (
                !Number.isInteger(
                    currentBalance
                ) ||
                currentBalance < 0
            ) {

                context.error(
                    "Invalid server coin balance."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Invalid account balance."
                    },
                    500
                );
            }


            const newBalance =
                currentBalance +
                rewardAmount;


            const newLifetimeEarned =
                currentLifetimeEarned +
                rewardAmount;


            // -------------------------------------------------
            // UPDATE USER BALANCE
            // -------------------------------------------------

            const updateResponse =
                await appwriteRequest(

                    userRowPath,

                    "PATCH",

                    {

                        data: {

                            coinBalance:
                                newBalance,

                            lifetimeEarned:
                                newLifetimeEarned
                        }
                    }
                );


            if (!updateResponse.ok) {

                context.error(
                    "Could not update user balance: " +
                    JSON.stringify(
                        updateResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not update your coin balance."
                    },
                    500
                );
            }


            // -------------------------------------------------
            // CREATE REWARD TRANSACTION
            // -------------------------------------------------

            const transactionResponse =
                await appwriteRequest(

                    "/tablesdb/" +
                    databaseId +
                    "/tables/" +
                    rewardTableId +
                    "/rows",

                    "POST",

                    {

                        rowId:
                            referenceID,

                        data: {

                            userID:
                                userId,

                            rewardType:
                                rewardType,

                            amount:
                                rewardAmount,

                            referenceID:
                                referenceID,

                            balanceBefore:
                                currentBalance,

                            balanceAfter:
                                newBalance
                        }
                    }
                );


            if (!transactionResponse.ok) {

                context.error(
                    "Reward transaction creation failed: " +
                    JSON.stringify(
                        transactionResponse.data
                    )
                );

                // IMPORTANT:
                // The balance was already updated.
                // We return an error so this situation
                // is visible in the logs and can be fixed.
                return context.res.json(
                    {
                        success: false,

                        message:
                            "Reward was processed but transaction logging failed."
                    },
                    500
                );
            }


            context.log(
                "Reward successfully granted: +" +
                rewardAmount +
                " coins to " +
                userId
            );


            return context.res.json(
                {
                    success: true,

                    operation:
                        "reward_coins",

                    rewardType:
                        rewardType,

                    amount:
                        rewardAmount,

                    balance:
                        newBalance,

                    message:
                        "Coins rewarded successfully."
                }
            );


        } catch (error) {

            context.error(
                "Reward coins error: " +
                (error.message || error)
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        error.message ||
                        "Coin reward failed."
                },
                500
            );
        }
    }


    // =====================================================
    // UNKNOWN OPERATION
    // =====================================================

    return context.res.json(
        {
            success: false,

            message:
                "Unknown Learnpidia backend operation."
        },
        400
    );
};
