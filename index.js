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
        "6abbf9f8000f2fab9b04";


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
        requestData.operation ||
        context.req.headers["x-learnpidia-operation"] ||
        "create_user";


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

                            streakLastClaimDate:
                                "",

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
    // CLAIM DAILY STREAK REWARD
    // =====================================================

    if (operation === "claim_daily_reward") {

        try {

            // -------------------------------------------------
            // GET CURRENT USER ROW
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
                    "Could not read user row for daily reward: " +
                    JSON.stringify(
                        userResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not read your Learnpidia account."
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


            const currentStreakDay =
                Number(
                    userRow.streakDay || 0
                );


            const lastClaimDate =
                String(
                    userRow.streakLastClaimDate || ""
                );


            // -------------------------------------------------
            // VALIDATE CURRENT BALANCE
            // -------------------------------------------------

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


            // -------------------------------------------------
            // GET TODAY'S DATE IN ANGOLA
            // -------------------------------------------------

            const dateParts =
                new Intl.DateTimeFormat(
                    "en-US",
                    {
                        timeZone:
                            "Africa/Luanda",

                        year:
                            "numeric",

                        month:
                            "2-digit",

                        day:
                            "2-digit"
                    }
                ).formatToParts(
                    new Date()
                );


            const dateValues = {};


            dateParts.forEach(
                function (part) {

                    if (
                        part.type !== "literal"
                    ) {

                        dateValues[
                            part.type
                        ] =
                            part.value;
                    }
                }
            );


            const today =
                dateValues.year +
                "-" +
                dateValues.month +
                "-" +
                dateValues.day;


            // -------------------------------------------------
            // CHECK IF ALREADY CLAIMED TODAY
            // -------------------------------------------------

            if (
                lastClaimDate === today
            ) {

                return context.res.json(
                    {
                        success: false,

                        alreadyClaimed:
                            true,

                        message:
                            "Today's daily reward has already been claimed."
                    },
                    409
                );
            }


            // -------------------------------------------------
            // DETERMINE STREAK DAY
            // -------------------------------------------------

            let newStreakDay =
                1;


            if (
                lastClaimDate
            ) {

                const previousParts =
                    lastClaimDate.split(
                        "-"
                    );


                if (
                    previousParts.length === 3
                ) {

                    const previousDate =
                        Date.UTC(
                            Number(
                                previousParts[0]
                            ),

                            Number(
                                previousParts[1]
                            ) - 1,

                            Number(
                                previousParts[2]
                            )
                        );


                    const todayParts =
                        today.split(
                            "-"
                        );


                    const todayDate =
                        Date.UTC(
                            Number(
                                todayParts[0]
                            ),

                            Number(
                                todayParts[1]
                            ) - 1,

                            Number(
                                todayParts[2]
                            )
                        );


                    const differenceInDays =
                        Math.round(
                            (
                                todayDate -
                                previousDate
                            ) /
                            (
                                1000 *
                                60 *
                                60 *
                                24
                            )
                        );


                    // -------------------------------------------------
                    // CLAIMED YESTERDAY
                    // CONTINUE STREAK
                    // -------------------------------------------------

                    if (
                        differenceInDays === 1
                    ) {

                        newStreakDay =
                            currentStreakDay >= 7
                                ? 1
                                : currentStreakDay + 1;
                    }


                    // -------------------------------------------------
                    // MISSED ONE OR MORE DAYS
                    // RESET TO DAY 1
                    // -------------------------------------------------

                    else if (
                        differenceInDays > 1
                    ) {

                        newStreakDay =
                            1;
                    }


                    // -------------------------------------------------
                    // INVALID / UNEXPECTED DATE
                    // RESET TO DAY 1
                    // -------------------------------------------------

                    else {

                        newStreakDay =
                            1;
                    }

                }

            }


            // -------------------------------------------------
            // SERVER-CONTROLLED DAILY REWARDS
            // -------------------------------------------------

            const dailyRewards = {

                1:
                    20,

                2:
                    40,

                3:
                    60,

                4:
                    80,

                5:
                    100,

                6:
                    150,

                7:
                    300
            };


            const rewardAmount =
                dailyRewards[
                    newStreakDay
                ];


            if (
                !rewardAmount
            ) {

                context.error(
                    "Invalid daily streak day: " +
                    newStreakDay
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Invalid daily reward."
                    },
                    500
                );
            }


            // -------------------------------------------------
            // UNIQUE REFERENCE FOR THIS USER + DATE
            // -------------------------------------------------

            const referenceID =
                "daily-streak-" +
                userId +
                "-" +
                today;


            // -------------------------------------------------
            // CHECK FOR DUPLICATE TRANSACTION
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

                        alreadyClaimed:
                            true,

                        message:
                            "Today's daily reward has already been claimed."
                    },
                    409
                );
            }


            // -------------------------------------------------
            // CALCULATE NEW VALUES
            // -------------------------------------------------

            const newBalance =
                currentBalance +
                rewardAmount;


            const newLifetimeEarned =
                currentLifetimeEarned +
                rewardAmount;


            // =================================================
            // CREATE DATABASE TRANSACTION
            // =================================================

            const transactionResponse =
                await appwriteRequest(

                    "/tablesdb/transactions",

                    "POST",

                    {}
                );


            if (!transactionResponse.ok) {

                context.error(
                    "Could not create daily reward transaction: " +
                    JSON.stringify(
                        transactionResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start daily reward transaction."
                    },
                    500
                );
            }


            const transactionId =
                transactionResponse.data.$id;


            if (!transactionId) {

                context.error(
                    "Daily reward transaction ID was not returned."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start daily reward transaction."
                    },
                    500
                );
            }


            // =================================================
            // STAGE BOTH OPERATIONS
            // =================================================

            const operationsResponse =
                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ) +
                    "/operations",

                    "POST",

                    {

                        operations: [

                            // ---------------------------------
                            // UPDATE USER
                            // ---------------------------------

                            {
                                action:
                                    "update",

                                databaseId:
                                    databaseId,

                                tableId:
                                    userTableId,

                                rowId:
                                    userId,

                                data: {

                                    coinBalance:
                                        newBalance,

                                    lifetimeEarned:
                                        newLifetimeEarned,

                                    streakDay:
                                        newStreakDay,

                                    streakLastClaimDate:
                                        today
                                }
                            },


                            // ---------------------------------
                            // CREATE REWARD TRANSACTION
                            // ---------------------------------

                            {
                                action:
                                    "create",

                                databaseId:
                                    databaseId,

                                tableId:
                                    rewardTableId,

                                rowId:
                                    referenceID,

                                data: {

                                    userID:
                                        userId,

                                    rewardType:
                                        "daily_streak",

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
                        ]
                    }
                );


            if (!operationsResponse.ok) {

                context.error(
                    "Could not stage daily reward operations: " +
                    JSON.stringify(
                        operationsResponse.data
                    )
                );


                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ),

                    "PATCH",

                    {
                        rollback:
                            true
                    }
                );


                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not prepare daily reward transaction."
                    },
                    500
                );
            }


            // =================================================
            // COMMIT TRANSACTION
            // =================================================

            const commitResponse =
                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ),

                    "PATCH",

                    {
                        commit:
                            true
                    }
                );


            if (!commitResponse.ok) {

                context.error(
                    "Daily reward transaction commit failed: " +
                    JSON.stringify(
                        commitResponse.data
                    )
                );


                return context.res.json(
                    {
                        success: false,

                        message:
                            "Daily reward transaction could not be completed."
                    },
                    500
                );
            }


            context.log(
                "Daily streak reward successfully granted: +" +
                rewardAmount +
                " coins. Day " +
                newStreakDay +
                " for user " +
                userId
            );


            // =================================================
            // SUCCESS
            // =================================================

            return context.res.json(
                {
                    success: true,

                    operation:
                        "claim_daily_reward",

                    streakDay:
                        newStreakDay,

                    amount:
                        rewardAmount,

                    balance:
                        newBalance,

                    claimDate:
                        today,

                    message:
                        "Daily reward claimed successfully."
                }
            );


        } catch (error) {

            context.error(
                "Daily reward error: " +
                (error.message || error)
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        error.message ||
                        "Daily reward claim failed."
                },
                500
            );
        }
    }

    // =====================================================
    // OPERATION 2
    // GET DAILY REWARD STATUS
    // =====================================================

    if (operation === "get_daily_reward_status") {

        try {

            // -------------------------------------------------
            // GET CURRENT USER ROW
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
                    "Could not read user row for daily reward status: " +
                    JSON.stringify(
                        userResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not read your Learnpidia account."
                    },
                    500
                );
            }


            const userRow =
                userResponse.data;


            const currentStreakDay =
                Number(
                    userRow.streakDay || 0
                );


            const lastClaimDate =
                String(
                    userRow.streakLastClaimDate || ""
                );


            // -------------------------------------------------
            // GET TODAY'S DATE IN ANGOLA
            // -------------------------------------------------

            const dateParts =
                new Intl.DateTimeFormat(
                    "en-US",
                    {
                        timeZone:
                            "Africa/Luanda",

                        year:
                            "numeric",

                        month:
                            "2-digit",

                        day:
                            "2-digit"
                    }
                ).formatToParts(
                    new Date()
                );


            const dateValues = {};


            dateParts.forEach(
                function (part) {

                    if (
                        part.type !== "literal"
                    ) {

                        dateValues[
                            part.type
                        ] =
                            part.value;
                    }
                }
            );


            const today =
                dateValues.year +
                "-" +
                dateValues.month +
                "-" +
                dateValues.day;


            // -------------------------------------------------
            // CHECK IF TODAY WAS ALREADY CLAIMED
            // -------------------------------------------------

            const claimedToday =
                lastClaimDate === today;


            // -------------------------------------------------
            // DETERMINE WHICH DAY IS AVAILABLE
            // -------------------------------------------------

            let availableStreakDay =
                1;


            if (claimedToday) {

                // Today's reward has already been claimed.
                // Keep the current streak day displayed.

                availableStreakDay =
                    currentStreakDay >= 1 &&
                    currentStreakDay <= 7
                        ? currentStreakDay
                        : 1;

            } else if (lastClaimDate) {

                const previousParts =
                    lastClaimDate.split(
                        "-"
                    );


                if (
                    previousParts.length === 3
                ) {

                    const previousDate =
                        Date.UTC(
                            Number(
                                previousParts[0]
                            ),

                            Number(
                                previousParts[1]
                            ) - 1,

                            Number(
                                previousParts[2]
                            )
                        );


                    const todayParts =
                        today.split(
                            "-"
                        );


                    const todayDate =
                        Date.UTC(
                            Number(
                                todayParts[0]
                            ),

                            Number(
                                todayParts[1]
                            ) - 1,

                            Number(
                                todayParts[2]
                            )
                        );


                    const differenceInDays =
                        Math.round(
                            (
                                todayDate -
                                previousDate
                            ) /
                            (
                                1000 *
                                60 *
                                60 *
                                24
                            )
                        );


                    // -------------------------------------------------
                    // CLAIMED YESTERDAY
                    // CONTINUE STREAK
                    // -------------------------------------------------

                    if (
                        differenceInDays === 1
                    ) {

                        availableStreakDay =
                            currentStreakDay >= 7
                                ? 1
                                : currentStreakDay + 1;

                    }

                    // -------------------------------------------------
                    // MISSED ONE OR MORE DAYS
                    // RESET TO DAY 1
                    // -------------------------------------------------

                    else {

                        availableStreakDay =
                            1;
                    }

                } else {

                    availableStreakDay =
                        1;
                }

            }


            // -------------------------------------------------
            // SUCCESS
            // -------------------------------------------------

            return context.res.json(
                {
                    success: true,

                    operation:
                        "get_daily_reward_status",

                    streakDay:
                        availableStreakDay,

                    lastClaimDate:
                        lastClaimDate,

                    today:
                        today,

                    claimedToday:
                        claimedToday
                }
            );


        } catch (error) {

            context.error(
                "Daily reward status error: " +
                (error.message || error)
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        error.message ||
                        "Could not get daily reward status."
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
            requestData.rewardType ||
            context.req.headers["x-learnpidia-reward-type"];

        const referenceID =
            requestData.referenceID ||
            context.req.headers["x-learnpidia-reference-id"];


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

        const allowedRewards = {

            rewarded_ad:
                100

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


            // =================================================
            // CREATE DATABASE TRANSACTION
            // =================================================

            const transactionResponse =
                await appwriteRequest(

                    "/tablesdb/transactions",

                    "POST",

                    {}
                );


            if (!transactionResponse.ok) {

                context.error(
                    "Could not create database transaction: " +
                    JSON.stringify(
                        transactionResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start reward transaction."
                    },
                    500
                );
            }


            const transactionId =
                transactionResponse.data.$id;


            if (!transactionId) {

                context.error(
                    "Transaction ID was not returned."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start reward transaction."
                    },
                    500
                );
            }


            context.log(
                "Reward transaction created: " +
                transactionId
            );


            // =================================================
            // STAGE BOTH DATABASE OPERATIONS
            // =================================================
            //
            // Nothing is permanently changed yet.
            //
            // Operation 1:
            // Update user's balance.
            //
            // Operation 2:
            // Create reward transaction record.
            //
            // Both will be committed together.
            // =================================================

            const operationsResponse =
                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ) +
                    "/operations",

                    "POST",

                    {

                        operations: [

                            {
                                action:
                                    "update",

                                databaseId:
                                    databaseId,

                                tableId:
                                    userTableId,

                                rowId:
                                    userId,

                                data: {

                                    coinBalance:
                                        newBalance,

                                    lifetimeEarned:
                                        newLifetimeEarned
                                }
                            },

                            {
                                action:
                                    "create",

                                databaseId:
                                    databaseId,

                                tableId:
                                    rewardTableId,

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
                        ]
                    }
                );


            if (!operationsResponse.ok) {

                context.error(
                    "Could not stage reward operations: " +
                    JSON.stringify(
                        operationsResponse.data
                    )
                );


                // Roll back the transaction.
                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ),

                    "PATCH",

                    {
                        rollback:
                            true
                    }
                );


                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not prepare reward transaction."
                    },
                    500
                );
            }


            context.log(
                "Reward operations staged successfully."
            );


            // =================================================
            // COMMIT TRANSACTION
            // =================================================

            const commitResponse =
                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ),

                    "PATCH",

                    {
                        commit:
                            true
                    }
                );


            if (!commitResponse.ok) {

                context.error(
                    "Reward transaction commit failed: " +
                    JSON.stringify(
                        commitResponse.data
                    )
                );


                return context.res.json(
                    {
                        success: false,

                        message:
                            "Reward transaction could not be completed."
                    },
                    500
                );
            }


            context.log(
                "Reward transaction committed successfully."
            );


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
    // OPERATION 3
    // ADD EXTRA LUCKY WHEEL SPIN
    // =====================================================

    if (operation === "add_wheel_spin") {

        const referenceID =
            requestData.referenceID ||
            context.req.headers["x-learnpidia-reference-id"];


        // -------------------------------------------------
        // REQUIRED REFERENCE
        // -------------------------------------------------

        if (!referenceID) {

            return context.res.json(
                {
                    success: false,

                    message:
                        "referenceID is required."
                },
                400
            );
        }


        try {

            // -------------------------------------------------
            // CHECK FOR DUPLICATE EXTRA-SPIN CLAIM
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

                        alreadyClaimed:
                            true,

                        message:
                            "This extra wheel spin has already been claimed."
                    },
                    409
                );
            }


            // -------------------------------------------------
            // GET CURRENT USER ROW
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
                    "Could not read user row for extra wheel spin: " +
                    JSON.stringify(
                        userResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not read your Learnpidia account."
                    },
                    500
                );
            }


            const userRow =
                userResponse.data;


            const currentWheelSpins =
                Number(
                    userRow.wheelSpins || 0
                );


            // -------------------------------------------------
            // VALIDATE CURRENT SPINS
            // -------------------------------------------------

            if (
                !Number.isInteger(
                    currentWheelSpins
                ) ||
                currentWheelSpins < 0
            ) {

                context.error(
                    "Invalid server wheel spin count."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Invalid wheel spin count."
                    },
                    500
                );
            }


            // -------------------------------------------------
            // ADD ONE EXTRA SPIN
            // -------------------------------------------------

            const newWheelSpins =
                currentWheelSpins + 1;


            // =================================================
            // CREATE DATABASE TRANSACTION
            // =================================================

            const transactionResponse =
                await appwriteRequest(

                    "/tablesdb/transactions",

                    "POST",

                    {}
                );


            if (!transactionResponse.ok) {

                context.error(
                    "Could not create extra wheel spin transaction: " +
                    JSON.stringify(
                        transactionResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start extra wheel spin transaction."
                    },
                    500
                );
            }


            const transactionId =
                transactionResponse.data.$id;


            if (!transactionId) {

                context.error(
                    "Extra wheel spin transaction ID was not returned."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start extra wheel spin transaction."
                    },
                    500
                );
            }


            // =================================================
            // STAGE BOTH OPERATIONS
            // =================================================

            const operationsResponse =
                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ) +
                    "/operations",

                    "POST",

                    {

                        operations: [

                            // ---------------------------------
                            // UPDATE USER
                            // ---------------------------------

                            {
                                action:
                                    "update",

                                databaseId:
                                    databaseId,

                                tableId:
                                    userTableId,

                                rowId:
                                    userId,

                                data: {

                                    wheelSpins:
                                        newWheelSpins
                                }
                            },


                            // ---------------------------------
                            // CREATE CLAIM RECORD
                            // ---------------------------------

                            {
                                action:
                                    "create",

                                databaseId:
                                    databaseId,

                                tableId:
                                    rewardTableId,

                                rowId:
                                    referenceID,

                                data: {

                                    userID:
                                        userId,

                                    rewardType:
                                        "extra_wheel_spin",

                                    amount:
                                        1,

                                    referenceID:
                                        referenceID,

                                    balanceBefore:
                                        Number(
                                            userRow.coinBalance
                                        ),

                                    balanceAfter:
                                        Number(
                                            userRow.coinBalance
                                        )
                                }
                            }
                        ]
                    }
                );


            if (!operationsResponse.ok) {

                context.error(
                    "Could not stage extra wheel spin operations: " +
                    JSON.stringify(
                        operationsResponse.data
                    )
                );


                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ),

                    "PATCH",

                    {
                        rollback:
                            true
                    }
                );


                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not prepare extra wheel spin transaction."
                    },
                    500
                );
            }


            // =================================================
            // COMMIT TRANSACTION
            // =================================================

            const commitResponse =
                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ),

                    "PATCH",

                    {
                        commit:
                            true
                    }
                );


            if (!commitResponse.ok) {

                context.error(
                    "Extra wheel spin transaction commit failed: " +
                    JSON.stringify(
                        commitResponse.data
                    )
                );


                return context.res.json(
                    {
                        success: false,

                        message:
                            "Extra wheel spin could not be completed."
                    },
                    500
                );
            }


            context.log(
                "Extra lucky wheel spin successfully added. " +
                "New spin count: " +
                newWheelSpins +
                " for user " +
                userId
            );


            // =================================================
            // SUCCESS
            // =================================================

            return context.res.json(
                {
                    success: true,

                    operation:
                        "add_wheel_spin",

                    wheelSpins:
                        newWheelSpins,

                    message:
                        "Extra lucky wheel spin added successfully."
                }
            );


        } catch (error) {

            context.error(
                "Add wheel spin error: " +
                (error.message || error)
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        error.message ||
                        "Could not add extra wheel spin."
                },
                500
            );
        }
    }

    // =====================================================
    // OPERATION 3
    // SPIN LUCKY WHEEL
    // =====================================================

    if (operation === "spin_lucky_wheel") {

        try {

            // -------------------------------------------------
            // GET CURRENT USER ROW
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
                    "Could not read user row for lucky wheel: " +
                    JSON.stringify(
                        userResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not read your Learnpidia account."
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


            const currentWheelSpins =
                Number(
                    userRow.wheelSpins || 0
                );


            // -------------------------------------------------
            // VALIDATE ACCOUNT VALUES
            // -------------------------------------------------

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


            if (
                !Number.isInteger(
                    currentWheelSpins
                ) ||
                currentWheelSpins < 0
            ) {

                context.error(
                    "Invalid wheel spin count."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Invalid wheel spin count."
                    },
                    500
                );
            }


            // -------------------------------------------------
            // CHECK AVAILABLE SPINS
            // -------------------------------------------------

            if (
                currentWheelSpins <= 0
            ) {

                return context.res.json(
                    {
                        success: false,

                        noSpinsAvailable:
                            true,

                        message:
                            "No free wheel spins are available."
                    },
                    409
                );
            }


            // -------------------------------------------------
            // SERVER-CONTROLLED WHEEL REWARDS
            // -------------------------------------------------

            const wheelRewards = [
                10,
                20,
                30,
                50,
                75,
                100,
                150,
                250
            ];


            // -------------------------------------------------
            // SERVER CHOOSES WINNING SLICE
            // -------------------------------------------------

            const selectedIndex =
                Math.floor(
                    Math.random() *
                    wheelRewards.length
                );


            const rewardAmount =
                wheelRewards[
                    selectedIndex
                ];


            // -------------------------------------------------
            // CALCULATE NEW VALUES
            // -------------------------------------------------

            const newWheelSpins =
                currentWheelSpins - 1;


            const newBalance =
                currentBalance +
                rewardAmount;


            const newLifetimeEarned =
                currentLifetimeEarned +
                rewardAmount;


            // -------------------------------------------------
            // UNIQUE REFERENCE
            // -------------------------------------------------

            const referenceID =
                "lucky-wheel-" +
                userId +
                "-" +
                Date.now();


            // =================================================
            // CREATE DATABASE TRANSACTION
            // =================================================

            const transactionResponse =
                await appwriteRequest(

                    "/tablesdb/transactions",

                    "POST",

                    {}
                );


            if (!transactionResponse.ok) {

                context.error(
                    "Could not create lucky wheel transaction: " +
                    JSON.stringify(
                        transactionResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start lucky wheel transaction."
                    },
                    500
                );
            }


            const transactionId =
                transactionResponse.data.$id;


            if (!transactionId) {

                context.error(
                    "Lucky wheel transaction ID was not returned."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start lucky wheel transaction."
                    },
                    500
                );
            }


            // =================================================
            // STAGE BOTH OPERATIONS
            // =================================================

            const operationsResponse =
                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ) +
                    "/operations",

                    "POST",

                    {

                        operations: [

                            // ---------------------------------
                            // UPDATE USER
                            // ---------------------------------

                            {
                                action:
                                    "update",

                                databaseId:
                                    databaseId,

                                tableId:
                                    userTableId,

                                rowId:
                                    userId,

                                data: {

                                    coinBalance:
                                        newBalance,

                                    lifetimeEarned:
                                        newLifetimeEarned,

                                    wheelSpins:
                                        newWheelSpins
                                }
                            },


                            // ---------------------------------
                            // CREATE REWARD TRANSACTION
                            // ---------------------------------

                            {
                                action:
                                    "create",

                                databaseId:
                                    databaseId,

                                tableId:
                                    rewardTableId,

                                rowId:
                                    referenceID,

                                data: {

                                    userID:
                                        userId,

                                    rewardType:
                                        "lucky_wheel",

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
                        ]
                    }
                );


            if (!operationsResponse.ok) {

                context.error(
                    "Could not stage lucky wheel operations: " +
                    JSON.stringify(
                        operationsResponse.data
                    )
                );


                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ),

                    "PATCH",

                    {
                        rollback:
                            true
                    }
                );


                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not prepare lucky wheel transaction."
                    },
                    500
                );
            }


            // =================================================
            // COMMIT TRANSACTION
            // =================================================

            const commitResponse =
                await appwriteRequest(

                    "/tablesdb/transactions/" +
                    encodeURIComponent(
                        transactionId
                    ),

                    "PATCH",

                    {
                        commit:
                            true
                    }
                );


            if (!commitResponse.ok) {

                context.error(
                    "Lucky wheel transaction commit failed: " +
                    JSON.stringify(
                        commitResponse.data
                    )
                );


                return context.res.json(
                    {
                        success: false,

                        message:
                            "Lucky wheel transaction could not be completed."
                    },
                    500
                );
            }


            context.log(
                "Lucky wheel reward successfully granted: +" +
                rewardAmount +
                " coins. Remaining spins: " +
                newWheelSpins +
                " for user " +
                userId
            );


            // =================================================
            // SUCCESS
            // =================================================

            return context.res.json(
                {
                    success: true,

                    operation:
                        "spin_lucky_wheel",

                    selectedIndex:
                        selectedIndex,

                    amount:
                        rewardAmount,

                    remainingSpins:
                        newWheelSpins,

                    balance:
                        newBalance,

                    message:
                        "Lucky wheel spin completed successfully."
                }
            );


        } catch (error) {

            context.error(
                "Lucky wheel error: " +
                (error.message || error)
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        error.message ||
                        "Lucky wheel spin failed."
                },
                500
            );
        }
    }

    // =====================================================
    // OPERATION 4
    // GET LUCKY WHEEL STATUS
    // =====================================================

    if (operation === "get_lucky_wheel_status") {

        try {

            // -------------------------------------------------
            // GET CURRENT USER ROW
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
                    "Could not read user row for lucky wheel status: " +
                    JSON.stringify(
                        userResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not read your Learnpidia account."
                    },
                    500
                );
            }


            // -------------------------------------------------
            // READ WHEEL SPINS
            // -------------------------------------------------

            const userRow =
                userResponse.data;


            const wheelSpins =
                Number(
                    userRow.wheelSpins || 0
                );


            // -------------------------------------------------
            // VALIDATE WHEEL SPINS
            // -------------------------------------------------

            if (
                !Number.isInteger(
                    wheelSpins
                ) ||
                wheelSpins < 0
            ) {

                context.error(
                    "Invalid server wheel spin count."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Invalid wheel spin count."
                    },
                    500
                );
            }


            // -------------------------------------------------
            // SUCCESS
            // -------------------------------------------------

            return context.res.json(
                {
                    success: true,

                    operation:
                        "get_lucky_wheel_status",

                    wheelSpins:
                        wheelSpins
                }
            );


        } catch (error) {

            context.error(
                "Lucky wheel status error: " +
                (error.message || error)
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        error.message ||
                        "Could not load lucky wheel status."
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
