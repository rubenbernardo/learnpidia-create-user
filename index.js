const {
    S3Client,
    GetObjectCommand
} = require("@aws-sdk/client-s3");

const {
    getSignedUrl
} = require("@aws-sdk/s3-request-presigner");

module.exports = async function (context) {

    const userId =
        context.req.headers["x-appwrite-user-id"];

    const apiKey =
        context.req.headers["x-appwrite-key"];

    const endpoint =
        process.env.APPWRITE_FUNCTION_API_ENDPOINT;

    const projectId =
        process.env.APPWRITE_FUNCTION_PROJECT_ID;

    const b2Client =
    new S3Client({
        endpoint:
            process.env.B2_ENDPOINT,

        region:
            "us-east-005",

        credentials: {
            accessKeyId:
                process.env.B2_KEY_ID,

            secretAccessKey:
                process.env.B2_APPLICATION_KEY
        }
    });

    const databaseId =
        "6abb1c93001ce3a10d64";

    const userTableId =
        "6abb1e6a003a48902765";

    const rewardTableId =
        "6abbf9f8000f2fab9b04";

    const knowledgeQuizQuestionsTableId =
    "6ac213c200378ddae29d";

    // =====================================================
    // CHECK FOR CPALEAD POSTBACK
    // =====================================================
    
    const cpaleadSubid =
            context.req.query.subid;
    
    const cpaleadLeadId =
            context.req.query.lead_id;
    
    const cpaleadPayout =
            context.req.query.payout;
    
        context.log(
        "CPALEAD API KEY PRESENT: " +
        Boolean(apiKey)
    );
    
    if (
            cpaleadSubid &&
            cpaleadLeadId
    ) {
    
            context.log(
                    "CPALead postback received for user: " +
                    cpaleadSubid +
                    " lead: " +
                    cpaleadLeadId +
                    " payout: " +
                    cpaleadPayout
            );

                const cpaleadPayoutAmount =
                Number(cpaleadPayout);

                if (
                !Number.isFinite(
                    cpaleadPayoutAmount
                ) ||
                cpaleadPayoutAmount <= 0
        ) {
        
            context.error(
                "Invalid CPALead payout: " +
                cpaleadPayout
            );
        
            return context.res.json(
                {
                    success: false,
                    message:
                        "Invalid CPALead payout."
                },
                400
            );
        }
        
        const cpaleadRewardCoins =
                Math.floor(
                    cpaleadPayoutAmount * 10000
                );

                if (
                cpaleadRewardCoins <= 0
        ) {
        
            context.error(
                "CPALead reward calculated as zero coins."
            );
        
            return context.res.json(
                {
                    success: false,
                    message:
                        "CPALead reward is too small."
                },
                400
            );
        }

        const cpaleadUserId =
        cpaleadSubid;

const cpaleadUserRowPath =
        "/tablesdb/" +
        databaseId +
        "/tables/" +
        userTableId +
        "/rows/" +
        encodeURIComponent(
            cpaleadUserId
        );

        const cpaleadUserResponse =
        await appwriteRequest(
            cpaleadUserRowPath,
            "GET"
        );


if (
        !cpaleadUserResponse.ok
) {

    context.error(
        "Could not find CPALead user: " +
        JSON.stringify(
            cpaleadUserResponse.data
        )
    );

    return context.res.json(
        {
            success: false,
            message:
                "Learnpidia user account was not found."
        },
        404
    );
}


const cpaleadUserRow =
        cpaleadUserResponse.data;

        const cpaleadCurrentBalance =
        Number(
            cpaleadUserRow.coinBalance
        );

const cpaleadCurrentLifetimeEarned =
        Number(
            cpaleadUserRow.lifetimeEarned || 0
        );


if (
        !Number.isInteger(
            cpaleadCurrentBalance
        ) ||
        cpaleadCurrentBalance < 0
) {

    context.error(
        "Invalid CPALead user coin balance."
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


const cpaleadNewBalance =
        cpaleadCurrentBalance +
        cpaleadRewardCoins;

const cpaleadNewLifetimeEarned =
        cpaleadCurrentLifetimeEarned +
        cpaleadRewardCoins;

        const cpaleadReferenceID =
        "cpalead_" +
        cpaleadLeadId;


const cpaleadDuplicateQuery =
        "/tablesdb/" +
        databaseId +
        "/tables/" +
        rewardTableId +
        "/rows/" +
        encodeURIComponent(
            cpaleadReferenceID
        );


const cpaleadExistingReward =
        await appwriteRequest(
            cpaleadDuplicateQuery,
            "GET"
        );


if (
        cpaleadExistingReward.ok
) {

    context.log(
        "CPALead duplicate lead ignored: " +
        cpaleadLeadId
    );

    return context.res.json(
        {
            success: true,
            message:
                "CPALead lead already rewarded."
        }
    );
}

        const cpaleadTransactionResponse =
        await appwriteRequest(
            "/tablesdb/transactions",
            "POST",
            {}
        );


if (
        !cpaleadTransactionResponse.ok
) {

    context.error(
        "Could not create CPALead transaction: " +
        JSON.stringify(
            cpaleadTransactionResponse.data
        )
    );

    return context.res.json(
        {
            success: false,
            message:
                "Could not start CPALead reward transaction."
        },
        500
    );
}


const cpaleadTransactionId =
        cpaleadTransactionResponse.data.$id;


if (!cpaleadTransactionId) {

    context.error(
        "CPALead transaction ID was not returned."
    );

    return context.res.json(
        {
            success: false,
            message:
                "Could not start CPALead reward transaction."
        },
        500
    );


}


context.log(
    "CPALead transaction created: " +
    cpaleadTransactionId
);

    const cpaleadOperationsResponse =
        await appwriteRequest(

            "/tablesdb/transactions/" +
            encodeURIComponent(
                cpaleadTransactionId
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
                            cpaleadUserId,

                        data: {

                            coinBalance:
                                cpaleadNewBalance,

                            lifetimeEarned:
                                cpaleadNewLifetimeEarned
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
                            cpaleadReferenceID,

                        data: {

                            userID:
                                cpaleadUserId,

                            rewardType:
                                "cpalead_offer",

                            amount:
                                cpaleadRewardCoins,

                            referenceID:
                                cpaleadReferenceID,

                            balanceBefore:
                                cpaleadCurrentBalance,

                            balanceAfter:
                                cpaleadNewBalance
                        }
                    }
                ]
            }
        );

        if (
        !cpaleadOperationsResponse.ok
) {

    context.error(
        "Could not stage CPALead reward operations: " +
        JSON.stringify(
            cpaleadOperationsResponse.data
        )
    );

    await appwriteRequest(

        "/tablesdb/transactions/" +
        encodeURIComponent(
            cpaleadTransactionId
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
                "Could not prepare CPALead reward."
        },
        500
    );
}


context.log(
    "CPALead reward operations staged successfully."
);

        const cpaleadCommitResponse =
        await appwriteRequest(

            "/tablesdb/transactions/" +
            encodeURIComponent(
                cpaleadTransactionId
            ),

            "PATCH",

            {
                commit:
                    true
            }
        );


if (
        !cpaleadCommitResponse.ok
) {

    context.error(
        "CPALead transaction commit failed: " +
        JSON.stringify(
            cpaleadCommitResponse.data
        )
    );

    return context.res.json(
        {
            success: false,
            message:
                "CPALead reward could not be completed."
        },
        500
    );
}


context.log(
    "CPALead transaction committed successfully."
);

        context.log(
    "CPALead reward successfully granted: +" +
    cpaleadRewardCoins +
    " coins to " +
    cpaleadUserId
);


return context.res.json(
    {
        success: true,

        operation:
            "cpalead_reward",

        payout:
            cpaleadPayoutAmount,

        amount:
            cpaleadRewardCoins,

        balance:
            cpaleadNewBalance,

        message:
            "CPALead reward processed successfully."
    }
);
        
        context.log(
            "CPALead reward coins: " +
            cpaleadRewardCoins
        );
    }
    
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

    context.log(
    "REQUEST QUERY: " +
    JSON.stringify(context.req.query)
);

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
    // HELPER: LUANDA DATE
    // =====================================================
    
    function getLuandaDateString() {
    
        return new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone: "Africa/Luanda",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ).format(
            new Date()
        );
    }


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

                            scratchResetDate:
                                getLuandaDateString(),

                            wheelSpins:
                                3,

                            wheelResetDate:
                                getLuandaDateString(),
                            
                            wheelExtraSpinUsed:
                                false,

                            quizAvailable:
                                true,
                            
                            quizResetDate:
                                getLuandaDateString(),
                            
                            unlockedProducts:
                                ""
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


// -------------------------------------------------
// CHECK DAILY LUANDA RESET
// -------------------------------------------------

const today =
    getLuandaDateString();

const scratchResetDate =
    userRow.scratchResetDate || "";


if (
    scratchResetDate !== today
) {

    // Reset to 2 cards for the new
    // Luanda calendar day.

    const resetResponse =
    await appwriteRequest(

        userRowPath,

        "PATCH",

        {
            data: {
                scratchCards: 2,
                scratchResetDate: today
            }
        }
    );


        if (!resetResponse.ok) {
    
            context.error(
                "Could not reset daily scratch cards: " +
                JSON.stringify(
                    resetResponse.data
                )
            );
    
            return context.res.json(
                {
                    success: false,
    
                    message:
                        "Could not reset your daily scratch cards."
                },
                500
            );
        }
    
    
        userRow.scratchCards =
            2;
    
        userRow.scratchResetDate =
            today;
    }
    
    
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
            
            
            const today =
                getLuandaDateString();
            
            
            const savedResetDate =
                userRow.wheelResetDate || "";
            
            
            let currentWheelSpins;
            
            
            let currentExtraSpinUsed;
            
            
            if (
                savedResetDate !== today
            ) {
            
                // -------------------------------------------------
                // NEW DAY
                // RESET LUCKY WHEEL
                // -------------------------------------------------
            
                currentWheelSpins =
                    3;
            
                currentExtraSpinUsed =
                    false;
            
            } else {
            
                // -------------------------------------------------
                // SAME DAY
                // KEEP CURRENT VALUES
                // -------------------------------------------------
            
                currentWheelSpins =
                    Number(
                        userRow.wheelSpins || 0
                    );
            
                currentExtraSpinUsed =
                    userRow.wheelExtraSpinUsed === true;
            }

            // -------------------------------------------------
            // CHECK EXTRA SPIN AVAILABILITY
            // -------------------------------------------------
            
            if (
                currentExtraSpinUsed
            ) {
            
                return context.res.json(
                    {
                        success: false,
            
                        alreadyClaimed:
                            true,
            
                        message:
                            "Your extra wheel spin has already been used today."
                    },
                    409
                );
            }
            
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
                                        newWheelSpins,
                                
                                    wheelResetDate:
                                        today,
                                
                                    wheelExtraSpinUsed:
                                        true
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


const today =
    getLuandaDateString();


const savedResetDate =
    userRow.wheelResetDate || "";


let currentWheelSpins;


let currentExtraSpinUsed;


if (
    savedResetDate !== today
) {

    // -------------------------------------------------
    // NEW DAY
    // RESET LUCKY WHEEL BEFORE SPIN
    // -------------------------------------------------

    currentWheelSpins =
        3;

    currentExtraSpinUsed =
        false;

} else {

    // -------------------------------------------------
    // SAME DAY
    // KEEP CURRENT VALUES
    // -------------------------------------------------

    currentWheelSpins =
        Number(
            userRow.wheelSpins || 0
        );

    currentExtraSpinUsed =
        userRow.wheelExtraSpinUsed === true;
}


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
                                    newWheelSpins,
                                
                                wheelResetDate:
                                    today,
                                
                                wheelExtraSpinUsed:
                                    currentExtraSpinUsed
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
            // READ WHEEL SPINS + DAILY RESET
            // -------------------------------------------------
            
            const userRow =
                userResponse.data;
            
            
            const today =
                getLuandaDateString();
            
            
            const savedResetDate =
                userRow.wheelResetDate || "";
            
            
            let wheelSpins;
            
            
            let extraSpinUsed;
            
            
            if (
                savedResetDate !== today
            ) {
            
                // -------------------------------------------------
                // NEW DAY
                // RESET LUCKY WHEEL
                // -------------------------------------------------
            
                wheelSpins =
                    3;
            
                extraSpinUsed =
                    false;
            
            } else {
            
                // -------------------------------------------------
                // SAME DAY
                // KEEP CURRENT VALUES
                // -------------------------------------------------
            
                wheelSpins =
                    Number(
                        userRow.wheelSpins || 0
                    );
            
                extraSpinUsed =
                    userRow.wheelExtraSpinUsed === true;
            }


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
            // SAVE DAILY RESET
            // -------------------------------------------------
            
            if (
                savedResetDate !== today
            ) {
            
                const updateResponse =
                    await appwriteRequest(
                        "/tablesdb/" +
                        databaseId +
                        "/tables/" +
                        userTableId +
                        "/rows/" +
                        userId,
                        "PATCH",
                        {
                            data: {
            
                                wheelSpins:
                                    3,
            
                                wheelResetDate:
                                    today,
            
                                wheelExtraSpinUsed:
                                    false
                            }
                        }
                    );
            
            
                if (!updateResponse.ok) {
            
                    context.error(
                        "Could not save lucky wheel reset: " +
                        JSON.stringify(
                            updateResponse.data
                        )
                    );
            
                    return context.res.json(
                        {
                            success: false,
            
                            message:
                                "Could not reset your lucky wheel."
                        },
                        500
                    );
                }
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
                        wheelSpins,
            
                    extraSpinUsed:
                        extraSpinUsed
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
    // OPERATION 5
    // GET SCRATCH CARD STATUS
    // =====================================================

    if (operation === "get_scratch_card_status") {

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
                    "Could not read user row for scratch card status: " +
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


// -------------------------------------------------
// CHECK DAILY LUANDA RESET
// -------------------------------------------------

const today =
    getLuandaDateString();

const scratchResetDate =
    userRow.scratchResetDate || "";


if (
    scratchResetDate !== today
) {

    // Reset to 2 cards for the new
    // Luanda calendar day.

   const resetResponse =
    await appwriteRequest(

        userRowPath,

        "PATCH",

        {
            data: {
                scratchCards: 2,
                scratchResetDate: today
            }
        }
    );


    if (!resetResponse.ok) {

        context.error(
            "Could not reset daily scratch cards: " +
            JSON.stringify(
                resetResponse.data
            )
        );

        return context.res.json(
            {
                success: false,

                message:
                    "Could not reset your daily scratch cards."
            },
            500
        );
    }


    userRow.scratchCards =
        2;

    userRow.scratchResetDate =
        today;
}


const scratchCards =
    Number(
        userRow.scratchCards || 0
    );


            // -------------------------------------------------
            // VALIDATE SCRATCH CARDS
            // -------------------------------------------------

            if (
                !Number.isInteger(
                    scratchCards
                ) ||
                scratchCards < 0
            ) {

                context.error(
                    "Invalid server scratch card count."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Invalid scratch card count."
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
                        "get_scratch_card_status",

                    scratchCards:
                        scratchCards
                }
            );


        } catch (error) {

            context.error(
                "Scratch card status error: " +
                (error.message || error)
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        error.message ||
                        "Could not load scratch card status."
                },
                500
            );
        }
    }


    // =====================================================
    // OPERATION 6
    // SCRATCH CARD
    // =====================================================

    if (operation === "scratch_card") {

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
            // CHECK FOR DUPLICATE SCRATCH REFERENCE
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
                            "This scratch card has already been claimed."
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
                    "Could not read user row for scratch card: " +
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


            const currentScratchCards =
                Number(
                    userRow.scratchCards || 0
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
                    currentScratchCards
                ) ||
                currentScratchCards < 0
            ) {

                context.error(
                    "Invalid server scratch card count."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Invalid scratch card count."
                    },
                    500
                );
            }


            // -------------------------------------------------
            // CHECK AVAILABLE SCRATCH CARDS
            // -------------------------------------------------

            if (
                currentScratchCards <= 0
            ) {

                return context.res.json(
                    {
                        success: false,

                        noCardsAvailable:
                            true,

                        message:
                            "No free scratch cards are available."
                    },
                    409
                );
            }


            // -------------------------------------------------
            // SERVER-CONTROLLED SCRATCH CARD REWARDS
            // -------------------------------------------------

            const scratchPrizes = [
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
            // SERVER CHOOSES WINNING PRIZE
            // -------------------------------------------------

            const selectedIndex =
                Math.floor(
                    Math.random() *
                    scratchPrizes.length
                );


            const rewardAmount =
                scratchPrizes[
                    selectedIndex
                ];


            // -------------------------------------------------
            // CALCULATE NEW VALUES
            // -------------------------------------------------

            const newScratchCards =
                currentScratchCards - 1;


            const newBalance =
                currentBalance +
                rewardAmount;


            const newLifetimeEarned =
                currentLifetimeEarned +
                rewardAmount;


            // =================================================
            // CREATE UNIQUE TRANSACTION
            // =================================================

            const transactionResponse =
                await appwriteRequest(

                    "/tablesdb/transactions",

                    "POST",

                    {}
                );


            if (!transactionResponse.ok) {

                context.error(
                    "Could not create scratch card transaction: " +
                    JSON.stringify(
                        transactionResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start scratch card transaction."
                    },
                    500
                );
            }


            const transactionId =
                transactionResponse.data.$id;


            if (!transactionId) {

                context.error(
                    "Scratch card transaction ID was not returned."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start scratch card transaction."
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

                                    scratchCards:
                                        newScratchCards
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
                                        "scratch_card",

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
                    "Could not stage scratch card operations: " +
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
                            "Could not prepare scratch card transaction."
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
                    "Scratch card transaction commit failed: " +
                    JSON.stringify(
                        commitResponse.data
                    )
                );


                return context.res.json(
                    {
                        success: false,

                        message:
                            "Scratch card transaction could not be completed."
                    },
                    500
                );
            }


            context.log(
                "Scratch card reward successfully granted: +" +
                rewardAmount +
                " coins. Remaining cards: " +
                newScratchCards +
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
                        "scratch_card",

                    selectedIndex:
                        selectedIndex,

                    amount:
                        rewardAmount,

                    remainingCards:
                        newScratchCards,

                    balance:
                        newBalance,

                    message:
                        "Scratch card completed successfully."
                }
            );


        } catch (error) {

            context.error(
                "Scratch card error: " +
                (error.message || error)
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        error.message ||
                        "Scratch card failed."
                },
                500
            );
        }
    }

    // =====================================================
    // OPERATION 7
    // GET KNOWLEDGE QUIZ STATUS
    // =====================================================

    if (operation === "get_knowledge_quiz_status") {

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
                    "Could not read user row for knowledge quiz status: " +
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


            // -------------------------------------------------
            // CHECK DAILY LUANDA RESET
            // -------------------------------------------------

            const today =
                getLuandaDateString();


            const quizResetDate =
                userRow.quizResetDate || "";


            if (
                quizResetDate !== today
            ) {

                // Reset the quiz for the new
                // Luanda calendar day.

                const resetResponse =
                    await appwriteRequest(

                        userRowPath,

                        "PATCH",

                        {
                            data: {

                                quizAvailable:
                                    true,

                                quizResetDate:
                                    today
                            }
                        }
                    );


                if (!resetResponse.ok) {

                    context.error(
                        "Could not reset daily knowledge quiz: " +
                        JSON.stringify(
                            resetResponse.data
                        )
                    );

                    return context.res.json(
                        {
                            success: false,

                            message:
                                "Could not reset your daily knowledge quiz."
                        },
                        500
                    );
                }


                userRow.quizAvailable =
                    true;

                userRow.quizResetDate =
                    today;
            }


            // -------------------------------------------------
            // READ QUIZ AVAILABILITY
            // -------------------------------------------------

            const quizAvailable =
                userRow.quizAvailable === true;


            // -------------------------------------------------
            // SUCCESS
            // -------------------------------------------------

            return context.res.json(
                {
                    success: true,

                    operation:
                        "get_knowledge_quiz_status",

                    quizAvailable:
                        quizAvailable
                }
            );


        } catch (error) {

            context.error(
                "Knowledge quiz status error: " +
                (error.message || error)
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        error.message ||
                        "Could not load knowledge quiz status."
                },
                500
            );
        }
    }

// =====================================================
// GET KNOWLEDGE QUIZ QUESTIONS
// =====================================================

if (operation === "get_knowledge_quiz_questions") {

    try {

        const questionsPath =
            "/tablesdb/" +
            databaseId +
            "/tables/" +
            knowledgeQuizQuestionsTableId +
            "/rows";

        const questionsResponse =
            await appwriteRequest(
                questionsPath,
                "GET"
            );

        if (!questionsResponse.ok) {

            context.error(
                "Could not read knowledge quiz questions: " +
                JSON.stringify(
                    questionsResponse.data
                )
            );

            return context.res.json(
                {
                    success: false,
                    message:
                        "Could not load knowledge quiz questions."
                },
                500
            );
        }

        const rows =
            questionsResponse.data.rows || [];

       const questions =
            rows.map(
                row => row
            );

        return context.res.json(
            {
                success: true,
                operation:
                    "get_knowledge_quiz_questions",
                questions:
                    questions
            }
        );

    } catch (error) {

        context.error(
            "Knowledge quiz questions error: " +
            (error.message || error)
        );

        return context.res.json(
            {
                success: false,
                message:
                    error.message ||
                    "Could not load knowledge quiz questions."
            },
            500
        );
    }
}
    
    // =====================================================
    // OPERATION 8
    // COMPLETE KNOWLEDGE QUIZ
    // =====================================================

    if (operation === "complete_knowledge_quiz") {

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
            // CHECK FOR DUPLICATE QUIZ REFERENCE
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
                            "This knowledge quiz has already been claimed."
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
                    "Could not read user row for knowledge quiz: " +
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


            // -------------------------------------------------
            // CHECK DAILY LUANDA RESET
            // -------------------------------------------------

            const today =
                getLuandaDateString();


            const quizResetDate =
                userRow.quizResetDate || "";


            let quizAvailable =
                userRow.quizAvailable === true;


            if (
                quizResetDate !== today
            ) {

                quizAvailable =
                    true;

                userRow.quizResetDate =
                    today;
            }


            // -------------------------------------------------
            // CHECK QUIZ AVAILABILITY
            // -------------------------------------------------

            if (!quizAvailable) {

                return context.res.json(
                    {
                        success: false,

                        alreadyCompleted:
                            true,

                        message:
                            "Today's knowledge quiz has already been completed."
                    },
                    409
                );
            }


            // -------------------------------------------------
            // GET CURRENT ACCOUNT VALUES
            // -------------------------------------------------

            const currentBalance =
                Number(
                    userRow.coinBalance
                );


            const currentLifetimeEarned =
                Number(
                    userRow.lifetimeEarned || 0
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
                    currentLifetimeEarned
                ) ||
                currentLifetimeEarned < 0
            ) {

                context.error(
                    "Invalid lifetime earned value."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Invalid lifetime earned value."
                    },
                    500
                );
            }


            // -------------------------------------------------
            // KNOWLEDGE QUIZ REWARD
            // -------------------------------------------------

            const rewardAmount =
                150;


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
            // CREATE UNIQUE TRANSACTION
            // =================================================

            const transactionResponse =
                await appwriteRequest(

                    "/tablesdb/transactions",

                    "POST",

                    {}
                );


            if (!transactionResponse.ok) {

                context.error(
                    "Could not create knowledge quiz transaction: " +
                    JSON.stringify(
                        transactionResponse.data
                    )
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start knowledge quiz transaction."
                    },
                    500
                );
            }


            const transactionId =
                transactionResponse.data.$id;


            if (!transactionId) {

                context.error(
                    "Knowledge quiz transaction ID was not returned."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Could not start knowledge quiz transaction."
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

                                    quizAvailable:
                                        false,

                                    quizResetDate:
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
                                        "knowledge_quiz",

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
                    "Could not stage knowledge quiz operations: " +
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
                            "Could not prepare knowledge quiz transaction."
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
                    "Knowledge quiz transaction commit failed: " +
                    JSON.stringify(
                        commitResponse.data
                    )
                );


                return context.res.json(
                    {
                        success: false,

                        message:
                            "Knowledge quiz transaction could not be completed."
                    },
                    500
                );
            }


            context.log(
                "Knowledge quiz reward successfully granted: +" +
                rewardAmount +
                " coins for user " +
                userId
            );


            // =================================================
            // SUCCESS
            // =================================================

            return context.res.json(
                {
                    success: true,

                    operation:
                        "complete_knowledge_quiz",

                    amount:
                        rewardAmount,

                    balance:
                        newBalance,

                    quizAvailable:
                        false,

                    message:
                        "Knowledge quiz completed successfully."
                }
            );


        } catch (error) {

            context.error(
                "Knowledge quiz completion error: " +
                (error.message || error)
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        error.message ||
                        "Knowledge quiz failed."
                },
                500
            );
        }
    }

    // =====================================================
// PURCHASE DIGITAL PRODUCT
// =====================================================

if (operation === "purchase_product") {

    try {

        // -------------------------------------------------
        // READ PRODUCT ID
        // -------------------------------------------------

        const productId =
            String(
                requestData.productId || ""
            ).trim();


        if (!productId) {

            return context.res.json(
                {
                    success: false,

                    message:
                        "Product ID is required."
                },
                400
            );
        }


        // -------------------------------------------------
        // SERVER-SIDE PRODUCT CATALOG
        // -------------------------------------------------

        const products = {

            "cut-smart": {

                price:
                    15000,

                fileKey:
                    "Cut Smart - Ebook.pdf"
            },

            "hire-right-keep-them-longer": {
                price: 25000,
                fileKey:
                    "Business & Entrepreneurship/Books/Hire Right, Keep Them Longer - Book.pdf"
            },

            "agency-growth-blueprint": {
                price: 40000,
                fileKey:
                    "Business & Entrepreneurship/Books/Agency Growth Blueprint - Ebook.pdf"
            },

            "build-an-ecommerce-store-that-sells": {
                price: 35000,
                fileKey:
                    "Business & Entrepreneurship/Books/Build an Ecommerce Store That Sells - Ebook.pdf"
            },

            "creating-the-perfect-customer-experience": {
                price: 32000,
                fileKey:
                    "Business & Entrepreneurship/Books/Creating the Perfect Customer Experience - Ebook.pdf"
            },

            "how-to-build-a-consistent-visual-identity": {
                price: 28000,
                fileKey:
                    "Business & Entrepreneurship/Books/How to Build a Consistent Visual Identity - Book.pdf"
            },

            "how-to-franchise-your-business": {
                price: 50000,
                fileKey:
                    "Business & Entrepreneurship/Books/How to Franchise Your Business - Ebook.pdf"
            },

            "merch-that-sticks": {
                price: 20000,
                fileKey:
                    "Business & Entrepreneurship/Books/Merch That Sticks - Ebook.pdf"
            },

            "package-what-you-know-into-a-high-ticket-offer": {
                price: 48000,
                fileKey:
                    "Business & Entrepreneurship/Books/Package What You Know Into a High-Ticket Offer - Ebook.pdf"
            },

            "pick-your-passive-income-stream": {
                price: 30000,
                fileKey:
                    "Business & Entrepreneurship/Books/Pick Your Passive Income Stream - Ebook.pdf"
            },

            "swot-analysis-simplified": {
                price: 10000,
                fileKey:
                    "Business & Entrepreneurship/Books/SWOT Analysis Simplified - Ebook.pdf"
            },

            "the-brand-evolution-system-for-modern-creators": {
                price: 38000,
                fileKey:
                    "Business & Entrepreneurship/Books/The Brand Evolution System for Modern Creators - Ebook.pdf"
            },

            "the-business-model-blueprint": {
                price: 34000,
                fileKey:
                    "Business & Entrepreneurship/Books/The Business Model Blueprint - Ebook.pdf"
            },

            "the-cash-flow-system-for-small-businesses": {
                price: 42000,
                fileKey:
                    "Business & Entrepreneurship/Books/The Cash Flow System for Small Businesses - Ebook.pdf"
            },

            "the-first-time-entrepreneur-launchpad": {
                price: 24000,
                fileKey:
                    "Business & Entrepreneurship/Books/The First Time Entrepreneur Launchpad - Book.pdf"
            },

            "the-freelancers-cash-bridge": {
                price: 22000,
                fileKey:
                    "Business & Entrepreneurship/Books/The Freelancer's Cash Bridge - Book.pdf"
            },

            "the-neuroinclusive-managers-playbook": {
                price: 26000,
                fileKey:
                    "Business & Entrepreneurship/Books/The Neuroinclusive Manager's Playbook - Ebook.pdf"
            },

            "the-psychology-of-closing": {
                price: 36000,
                fileKey:
                    "Business & Entrepreneurship/Books/The Psychology of Closing - Ebook.pdf"
            },

            "turn-sales-into-predictable-growth": {
                price: 45000,
                fileKey:
                    "Business & Entrepreneurship/Books/Turn Sales Into Predictable Growth - Ebook.pdf"
            },

            "turn-your-expertise-into-5k-workshop-days": {
                price: 46000,
                fileKey:
                    "Business & Entrepreneurship/Books/Turn Your Expertise Into $5K Workshop Days - Ebook.pdf"
            },

            "visual-selling": {
                price: 30000,
                fileKey:
                    "Business & Entrepreneurship/Books/Visual Selling - Ebook.pdf"
            },

            "audit-your-plan-before-you-commit-capital": {
                price:
                    500,
                fileKey:
                    "Business & Entrepreneurship/Checklist/Audit Your Plan Before You Commit Capital Checklist.pdf"
            },

            "is-your-marketplace-listing-ready-to-publish": {
                price:
                    250,
                fileKey:
                    "Business & Entrepreneurship/Checklist/Is Your Marketplace Listing Ready to Publish Checklist.pdf"
            },

            "kill-the-franken-stack": {
                price:
                    350,
                fileKey:
                    "Business & Entrepreneurship/Checklist/Kill the Franken-Stack Checklist.pdf"
            },

            "minimum-viable-offer-design": {
                price:
                    400,
                fileKey:
                    "Business & Entrepreneurship/Checklist/Minimum Viable Offer Design - Checklist.pdf"
            },

            "outcome-based-job-posting-creation": {
                price:
                    300,
                fileKey:
                    "Business & Entrepreneurship/Checklist/Outcome-Based Job Posting Creation Checklist.pdf"
            },

            "pre-launch-brand-kit-setup": {
                price:
                    150,
                fileKey:
                    "Business & Entrepreneurship/Checklist/Pre-Launch Brand Kit Setup Checklist.pdf"
            },

            "pre-launch-store-validation": {
                price:
                    420,
                fileKey:
                    "Business & Entrepreneurship/Checklist/Pre-Launch Store Validation Checklist.pdf"
            },

            "red-light-emergency-protocol": {
                price:
                    480,
                fileKey:
                    "Business & Entrepreneurship/Checklist/Red Light Emergency Protocol - Checklist.pdf"
            },

            "the-brain-friendly-hiring": {
                price:
                    200,
                fileKey:
                    "Business & Entrepreneurship/Checklist/The Brain-Friendly Hiring Checklist.pdf"
            },

            "the-scalable-service-delivery-setup": {
                price:
                    450,
                fileKey:
                    "Business & Entrepreneurship/Checklist/The Scalable Service Delivery Setup Checklist.pdf"
            },

            "from-hourly-to-value-based-pricing": {
                price:
                    3000,
                fileKey:
                    "Business & Entrepreneurship/Guide/From Hourly to Value-Based Pricing - Guide.pdf"
            },

            "productize-any-freelance-skill-in-one-weekend": {
                price:
                    2500,
                fileKey:
                    "Business & Entrepreneurship/Guide/Productize Any Freelance Skill in One Weekend - Guide.pdf"
            },

            "score-your-passive-income-idea-in-30-minutes": {
                price:
                    500,
                fileKey:
                    "Business & Entrepreneurship/Guide/Score Your Passive Income Idea in 30 Minutes - Guide.pdf"
            },

            "site-speed-optimization-for-non-technical-store-owners": {
                price:
                    1200,
                fileKey:
                    "Business & Entrepreneurship/Guide/Site Speed Optimization for Non-Technical Store Owners - Guide.pdf"
            },

            "stop-losing-top-talent-at-the-interview-stage": {
                price:
                    1500,
                fileKey:
                    "Business & Entrepreneurship/Guide/Stop Losing Top Talent at the Interview Stage - Guide.pdf"
            },

            "the-30-day-lean-launch-plan": {
                price:
                    2800,
                fileKey:
                    "Business & Entrepreneurship/Guide/The 30-Day Lean Launch Plan - Guide.pdf"
            },

            "the-four-beat-vendor-renegotiation-script": {
                price:
                    800,
                fileKey:
                    "Business & Entrepreneurship/Guide/The Four-Beat Vendor Renegotiation Script - Guide.pdf"
            },

            "the-structured-interview-playbook": {
                price:
                    1800,
                fileKey:
                    "Business & Entrepreneurship/Guide/The Structured Interview Playbook - Guide.pdf"
            },

            "the-three-number-pricing-formula": {
                price:
                    1000,
                fileKey:
                    "Business & Entrepreneurship/Guide/The Three-Number Pricing Formula - Guide.pdf"
            },

            "the-weekend-cash-control-setup": {
                price:
                    2200,
                fileKey:
                    "Business & Entrepreneurship/Guide/The Weekend Cash Control Setup - Guide.pdf"
            },

            "7-branding-errors-hidden-in-your-company-merchandise": {
                price:
                    600,
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Branding Errors Hidden in Your Company Merchandise - Listicle.pdf"
            },

            "7-business-model-blind-spots-that-kill-startups": {
                price:
                    800,
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Business Model Blind Spots That Kill Startups - Listicle.pdf"
            },

            "7-cash-flow-mistakes-that-sink-profitable-businesses": {
                price:
                    880,
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Cash Flow Mistakes That Sink Profitable Businesses - Listicle.pdf"
            },

            "7-cost-cuts-that-save-cash-now-and-bleed-profit-later": {
                price:
                    850,
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Cost Cuts That Save Cash Now and Bleed Profit Later - Listicle.pdf"
            },

            "7-critical-mistakes-that-sabotage-most-swot-analyses": {
                price:
                    680,
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Critical Mistakes That Sabotage Most SWOT Analyses - Listicle.pdf"
            },

            "7-mistakes-that-keep-agencies-stuck-in-chaos-and-burnout": {
                price:
                    760,
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Mistakes That Keep Agencies Stuck in Chaos and Burnout - Listicle.pdf"
            },

            "7-passive-income-lies-that-cost-first-time-builders-20000": {
                price:
                    940,
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Passive Income Lies That Cost First-Time Builders $20,000 - Listicle.pdf"
            },

            "7-workplace-policies-that-accidentally-block-neurodivergent-talent": {
                price:
                    500,
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Workplace Policies That Accidentally Block Neurodivergent Talent - Listicle.pdf"
            },

            "12-fatal-mistakes-that-kill-workshop-success": {
                price:
                    740,
                fileKey:
                    "Business & Entrepreneurship/Listicle/12 Fatal Mistakes That Kill Workshop Success - Listicle.pdf"
            },

            "12-merchandise-secrets-that-break-the-rules-and-win-big": {
                price:
                    700,
                fileKey:
                    "Business & Entrepreneurship/Listicle/12 Merchandise Secrets That Break the Rules and Win Big - Listicle.pdf"
            },

            "13-cash-bridge-moves-every-freelancer-needs-before-their-next-net-30-wait": {
                price:
                    900,
                fileKey:
                    "Business & Entrepreneurship/Listicle/13 Cash Bridge Moves Every Freelancer Needs Before Their Next Net-30 Wait - Listicle.pdf"
            },

            "13-signals-your-personal-brand-needs-a-strategic-refresh": {
                price:
                    620,
                fileKey:
                    "Business & Entrepreneurship/Listicle/13 Signals Your Personal Brand Needs a Strategic Refresh - Listicle.pdf"
            },

            "13-visual-decisions-that-separate-professional-brands-from-amateur-ones": {
                price:
                    790,
                fileKey:
                    "Business & Entrepreneurship/Listicle/13 Visual Decisions That Separate Professional Brands From Amateur Ones - Listicle.pdf"
            },

            "21-business-model-checks-investors-expect-you-to-pass": {
                price:
                    1000,
                fileKey:
                    "Business & Entrepreneurship/Listicle/21 Business Model Checks Investors Expect You to Pass - Listicle.pdf"
            },

            "21-money-traps-that-kill-first-time-businesses-before-they-start": {
                price:
                    970,
                fileKey:
                    "Business & Entrepreneurship/Listicle/21 Money Traps That Kill First-Time Businesses Before They Start - Listicle.pdf"
            },

            "21-objections-that-actually-mean-they-want-to-buy": {
                price:
                    820,
                fileKey:
                    "Business & Entrepreneurship/Listicle/21 Objections That Actually Mean They Want to Buy - Listicle.pdf"
            },

            "21-reasons-why-you-keep-losing-candidates-to-your-competitors": {
                price:
                    750,
                fileKey:
                    "Business & Entrepreneurship/Listicle/21 Reasons Why You Keep Losing Candidates to Your Competitors - Listicle.pdf"
            },

            "21-workshop-secrets-that-create-consistent-revenue": {
                price:
                    1000,
                fileKey:
                    "Business & Entrepreneurship/Listicle/21 Workshop Secrets That Create Consistent Revenue - Listicle.pdf"
            },

            "agency-transformation-assistant": {
                price:
                    1200,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Agency Transformation Assistant - Prompts.pdf"
            },

            "build-your-high-ticket-service-business": {
                price:
                    1500,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Build Your High-Ticket Service Business - Prompts.pdf"
            },

            "control-your-business-cash-flow": {
                price:
                    1400,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Control Your Business Cash Flow - Prompts.pdf"
            },

            "create-professional-visual-identity": {
                price:
                    900,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Create Professional Visual Identity - Prompts.pdf"
            },

            "first-time-entrepreneurs-launch-assistant": {
                price:
                    750,
                fileKey:
                    "Business & Entrepreneurship/Prompts/First-Time Entrepreneurs Launch Assistant - Prompts.pdf"
            },

            "mastering-confident-sales-closing": {
                price:
                    1100,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Mastering Confident Sales Closing - Prompts.pdf"
            },

            "neuroinclusive-leadership-copilot": {
                price:
                    800,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Neuroinclusive Leadership Copilot - Prompts.pdf"
            },

            "passive-income-build-systematize": {
                price:
                    1300,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Passive Income Build & Systematize - Prompts.pdf"
            },

            "strategic-brand-evolution": {
                price:
                    1150,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Strategic Brand Evolution - Prompts.pdf"
            },

            "strategic-cost-reduction": {
                price:
                    1250,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Strategic Cost Reduction - Prompts.pdf"
            },

            "strategic-planning-assistant": {
                price:
                    500,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Strategic Planning Assistant - Prompts.pdf"
            },

            "talent-acquisition-assistant": {
                price:
                    700,
                fileKey:
                    "Business & Entrepreneurship/Prompts/Talent Acquisition Assistant - Prompts.pdf"
            },

            "the-e-commerce-store-architect": {
                price:
                    1450,
                fileKey:
                    "Business & Entrepreneurship/Prompts/The E-Commerce Store Architect - Prompts.pdf"
            },

            "the-freelancers-fast-cash-strategies": {
                price:
                    1000,
                fileKey:
                    "Business & Entrepreneurship/Prompts/The Freelancer’s Fast Cash Strategies - Prompts.pdf"
            },

            "agency-operations-and-scaling": {
                price:
                    5000,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Agency Operations & Scaling - Toolstack.pdf"
            },

            "build-positive-digital-presence": {
                price:
                    2200,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Build Positive Digital Presence - Toolstack.pdf"
            },

            "confidently-close-every-call": {
                price:
                    3600,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Confidently Close Every Call - Toolstack.pdf"
            },

            "crafting-irresistible-business-offers": {
                price:
                    4500,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Crafting Irresistible Business Offers - Toolstack.pdf"
            },

            "digital-creator’s-buddy": {
                price:
                    1800,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Digital Creator's Buddy - Toolstack.pdf"
            },

            "high-ticket-affiliate-marketing": {
                price:
                    4800,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/High-Ticket Affiliate Marketing - Toolstack.pdf"
            },

            "how-to-build-a-website": {
                price:
                    2500,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/How to Build a Website - Toolstack.pdf"
            },

            "marketing-plan-simplified": {
                price:
                    1500,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Marketing Plan Simplified - Toolstack.pdf"
            },

            "microsaas-success-blueprint": {
                price:
                    4900,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/MicroSaas Success Blueprint - Toolstack.pdf"
            },

            "power-up-your-brand": {
                price:
                    1200,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Power Up Your Brand - Toolstack.pdf"
            },

            "sell-with-design": {
                price:
                    2800,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Sell With Design - Toolstack.pdf"
            },

            "the-power-of-prototypes": {
                price:
                    3200,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/The Power of Prototypes - Toolstack.pdf"
            },

            "understanding-business-metrics": {
                price:
                    4000,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Understanding Business Metrics - Toolstack.pdf"
            },

            "validate-business-ideas": {
                price:
                    3000,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Validate Business Ideas - Toolstack.pdf"
            },

            "winning-product-research": {
                price:
                    3500,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Winning Product Research - Toolstack.pdf"
            },

            "your-business-plan-playbook": {
                price:
                    1000,
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Your Business Plan Playbook - Toolstack.pdf"
            },,,

            "7-conversion-killers-hiding-on-your-product-pages": {
                price:
                    850,
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Conversion Killers Hiding on Your Product Pages - Listicle.pdf"
            },

            "beyond-the-side-hustle": {
                price:
                    32000,
                fileKey:
                    "Business & Entrepreneurship/Podcast/Beyond the Side Hustle - Podcast.pdf"
            },

            "business-cash-control": {
                price:
                    45000,
                fileKey:
                    "Business & Entrepreneurship/Podcast/Business Cash Control - Podcast.pdf"
            },

            "cost-control-that-compounds": {
                price:
                    45000,
                fileKey:
                    "Business & Entrepreneurship/Podcast/Cost Control That Compounds - Podcast.pdf"
            },

            "fast-cash-freelancer": {
                price:
                    28000,
                fileKey:
                    "Business & Entrepreneurship/Podcast/Fast Cash Freelancer - Podcast.pdf"
            },

            "hiring-without-regret": {
                price:
                    38000,
                fileKey:
                    "Business & Entrepreneurship/Podcast/Hiring Without Regret - Podcast.pdf"
            },

            "stores-that-convert": {
                price:
                    35000,
                fileKey:
                    "Business & Entrepreneurship/Podcast/Stores That Convert - Podcast.pdf"
            },

            "the-brain-friendly-workplace": {
                price:
                    25000,
                fileKey:
                    "Business & Entrepreneurship/Podcast/The Brain-Friendly Workplace - Podcast.pdf"
            },

            "the-entrepreneur-starting-line": {
                price:
                    20000,
                fileKey:
                    "Business & Entrepreneurship/Podcast/The Entrepreneur Starting Line - Podcast.pdf"
            },

            "the-scalable-expert-model": {
                price:
                    50000,
                fileKey:
                    "Business & Entrepreneurship/Podcast/The Scalable Expert Model - Podcast.pdf"
            },,

        };


        const product =
            products[productId];


        if (!product) {

            return context.res.json(
                {
                    success: false,

                    message:
                        "Product not found."
                },
                404
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
                "Could not read user row for product purchase: " +
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


        // -------------------------------------------------
        // READ SERVER VALUES
        // -------------------------------------------------

        const currentBalance =
            Number(
                userRow.coinBalance
            );


        const currentTotalSpent =
            Number(
                userRow.totalSpent || 0
            );


        const unlockedProductsText =
            String(
                userRow.unlockedProducts || ""
            );


        // -------------------------------------------------
        // VALIDATE SERVER VALUES
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
                currentTotalSpent
            ) ||
            currentTotalSpent < 0
        ) {

            context.error(
                "Invalid total spent value."
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        "Invalid account spending data."
                },
                500
            );
        }


        // -------------------------------------------------
        // READ UNLOCKED PRODUCTS
        // -------------------------------------------------

        let unlockedProducts = [];


        if (unlockedProductsText) {

            try {

                unlockedProducts =
                    JSON.parse(
                        unlockedProductsText
                    );

            } catch (error) {

                context.error(
                    "Invalid unlockedProducts data."
                );

                return context.res.json(
                    {
                        success: false,

                        message:
                            "Invalid product ownership data."
                    },
                    500
                );
            }
        }


        if (
            !Array.isArray(
                unlockedProducts
            )
        ) {

            context.error(
                "unlockedProducts is not an array."
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        "Invalid product ownership data."
                },
                500
            );
        }


        // -------------------------------------------------
        // CHECK IF ALREADY PURCHASED
        // -------------------------------------------------

        if (
            unlockedProducts.includes(
                productId
            )
        ) {

            return context.res.json(
                {
                    success: false,

                    alreadyOwned:
                        true,

                    message:
                        "You already own this product."
                },
                409
            );
        }


        // -------------------------------------------------
        // CHECK COIN BALANCE
        // -------------------------------------------------

        if (
            currentBalance <
            product.price
        ) {

            return context.res.json(
                {
                    success: false,

                    insufficientCoins:
                        true,

                    balance:
                        currentBalance,

                    price:
                        product.price,

                    message:
                        "Not enough LP Coins."
                },
                400
            );
        }


        // -------------------------------------------------
        // CALCULATE NEW VALUES
        // -------------------------------------------------

        const newBalance =
            currentBalance -
            product.price;


        const newTotalSpent =
            currentTotalSpent +
            product.price;


        unlockedProducts.push(
            productId
        );


        const newUnlockedProducts =
            JSON.stringify(
                unlockedProducts
            );


        // =================================================
        // CREATE APPWRITE TRANSACTION
        // =================================================

        const transactionResponse =
            await appwriteRequest(

                "/tablesdb/transactions",

                "POST",

                {}
            );


        if (!transactionResponse.ok) {

            context.error(
                "Could not create product purchase transaction: " +
                JSON.stringify(
                    transactionResponse.data
                )
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        "Could not start product purchase."
                },
                500
            );
        }


        const transactionId =
            transactionResponse.data.$id;


        if (!transactionId) {

            context.error(
                "Product purchase transaction ID was not returned."
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        "Could not start product purchase."
                },
                500
            );
        }


        // =================================================
        // STAGE USER UPDATE
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

                                totalSpent:
                                    newTotalSpent,

                                unlockedProducts:
                                    newUnlockedProducts
                            }
                        }
                    ]
                }
            );


        if (!operationsResponse.ok) {

            context.error(
                "Could not stage product purchase: " +
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
                        "Could not prepare product purchase."
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
                "Product purchase transaction commit failed: " +
                JSON.stringify(
                    commitResponse.data
                )
            );

            return context.res.json(
                {
                    success: false,

                    message:
                        "Product purchase could not be completed."
                },
                500
            );
        }


        // =================================================
        // SUCCESS
        // =================================================

        context.log(
            "Product purchased: " +
            productId +
            " for " +
            product.price +
            " coins by user " +
            userId
        );


        return context.res.json(
            {
                success:
                    true,

                operation:
                    "purchase_product",

                productId:
                    productId,

                price:
                    product.price,

                balance:
                    newBalance,

                unlocked:
                    true,

                message:
                    "Product purchased successfully."
            }
        );


    } catch (error) {

        context.error(
            "Product purchase error: " +
            (error.message || error)
        );

        return context.res.json(
            {
                success: false,

                message:
                    error.message ||
                    "Product purchase failed."
            },
            500
        );
    }
}

// =====================================================
// GET PRODUCT DOWNLOAD URL
// =====================================================

if (operation === "get_product_download_url") {

    try {

        const productId =
            requestData.productId;

        // -------------------------------------------------
        // SERVER-SIDE PRODUCT CATALOG
        // -------------------------------------------------

        const products = {
            "cut-smart": {
                fileKey:
                    "Cut Smart - Ebook.pdf"
            },
        
            "hire-right-keep-them-longer": {
                fileKey:
                    "Business & Entrepreneurship/Books/Hire Right, Keep Them Longer - Book.pdf"
            },

            "agency-growth-blueprint": {
                fileKey:
                    "Business & Entrepreneurship/Books/Agency Growth Blueprint - Ebook.pdf"
            },

            "build-an-ecommerce-store-that-sells": {
                fileKey:
                    "Business & Entrepreneurship/Books/Build an Ecommerce Store That Sells - Ebook.pdf"
            },

            "creating-the-perfect-customer-experience": {
                fileKey:
                    "Business & Entrepreneurship/Books/Creating the Perfect Customer Experience - Ebook.pdf"
            },

            "how-to-build-a-consistent-visual-identity": {
                fileKey:
                    "Business & Entrepreneurship/Books/How to Build a Consistent Visual Identity - Book.pdf"
            },

            "how-to-franchise-your-business": {
                fileKey:
                    "Business & Entrepreneurship/Books/How to Franchise Your Business - Ebook.pdf"
            },

            "merch-that-sticks": {
                fileKey:
                    "Business & Entrepreneurship/Books/Merch That Sticks - Ebook.pdf"
            },

            "package-what-you-know-into-a-high-ticket-offer": {
                fileKey:
                    "Business & Entrepreneurship/Books/Package What You Know Into a High-Ticket Offer - Ebook.pdf"
            },

            "pick-your-passive-income-stream": {
                fileKey:
                    "Business & Entrepreneurship/Books/Pick Your Passive Income Stream - Ebook.pdf"
            },

            "swot-analysis-simplified": {
                fileKey:
                    "Business & Entrepreneurship/Books/SWOT Analysis Simplified - Ebook.pdf"
            },

            "the-brand-evolution-system-for-modern-creators": {
                fileKey:
                    "Business & Entrepreneurship/Books/The Brand Evolution System for Modern Creators - Ebook.pdf"
            },

            "the-business-model-blueprint": {
                fileKey:
                    "Business & Entrepreneurship/Books/The Business Model Blueprint - Ebook.pdf"
            },

            "the-cash-flow-system-for-small-businesses": {
                fileKey:
                    "Business & Entrepreneurship/Books/The Cash Flow System for Small Businesses - Ebook.pdf"
            },

            "the-first-time-entrepreneur-launchpad": {
                fileKey:
                    "Business & Entrepreneurship/Books/The First Time Entrepreneur Launchpad - Book.pdf"
            },

            "the-freelancers-cash-bridge": {
                fileKey:
                    "Business & Entrepreneurship/Books/The Freelancer's Cash Bridge - Book.pdf"
            },

            "the-neuroinclusive-managers-playbook": {
                fileKey:
                    "Business & Entrepreneurship/Books/The Neuroinclusive Manager's Playbook - Ebook.pdf"
            },

            "the-psychology-of-closing": {
                fileKey:
                    "Business & Entrepreneurship/Books/The Psychology of Closing - Ebook.pdf"
            },

            "turn-sales-into-predictable-growth": {
                fileKey:
                    "Business & Entrepreneurship/Books/Turn Sales Into Predictable Growth - Ebook.pdf"
            },

            "turn-your-expertise-into-5k-workshop-days": {
                fileKey:
                    "Business & Entrepreneurship/Books/Turn Your Expertise Into $5K Workshop Days - Ebook.pdf"
            },

            "visual-selling": {
                fileKey:
                    "Business & Entrepreneurship/Books/Visual Selling - Ebook.pdf"
            },

            "audit-your-plan-before-you-commit-capital": {
                fileKey:
                    "Business & Entrepreneurship/Checklist/Audit Your Plan Before You Commit Capital Checklist.pdf"
            },

            "is-your-marketplace-listing-ready-to-publish": {
                fileKey:
                    "Business & Entrepreneurship/Checklist/Is Your Marketplace Listing Ready to Publish Checklist.pdf"
            },

            "kill-the-franken-stack": {
                fileKey:
                    "Business & Entrepreneurship/Checklist/Kill the Franken-Stack Checklist.pdf"
            },

            "minimum-viable-offer-design": {
                fileKey:
                    "Business & Entrepreneurship/Checklist/Minimum Viable Offer Design - Checklist.pdf"
            },

            "outcome-based-job-posting-creation": {
                fileKey:
                    "Business & Entrepreneurship/Checklist/Outcome-Based Job Posting Creation Checklist.pdf"
            },

            "pre-launch-brand-kit-setup": {
                fileKey:
                    "Business & Entrepreneurship/Checklist/Pre-Launch Brand Kit Setup Checklist.pdf"
            },

            "pre-launch-store-validation": {
                fileKey:
                    "Business & Entrepreneurship/Checklist/Pre-Launch Store Validation Checklist.pdf"
            },

            "red-light-emergency-protocol": {
                fileKey:
                    "Business & Entrepreneurship/Checklist/Red Light Emergency Protocol - Checklist.pdf"
            },

            "the-brain-friendly-hiring": {
                fileKey:
                    "Business & Entrepreneurship/Checklist/The Brain-Friendly Hiring Checklist.pdf"
            },

            "the-scalable-service-delivery-setup": {
                fileKey:
                    "Business & Entrepreneurship/Checklist/The Scalable Service Delivery Setup Checklist.pdf"
            },

            "from-hourly-to-value-based-pricing": {
                fileKey:
                    "Business & Entrepreneurship/Guide/From Hourly to Value-Based Pricing - Guide.pdf"
            },

            "productize-any-freelance-skill-in-one-weekend": {
                fileKey:
                    "Business & Entrepreneurship/Guide/Productize Any Freelance Skill in One Weekend - Guide.pdf"
            },

            "score-your-passive-income-idea-in-30-minutes": {
                fileKey:
                    "Business & Entrepreneurship/Guide/Score Your Passive Income Idea in 30 Minutes - Guide.pdf"
            },

            "site-speed-optimization-for-non-technical-store-owners": {
                fileKey:
                    "Business & Entrepreneurship/Guide/Site Speed Optimization for Non-Technical Store Owners - Guide.pdf"
            },

            "stop-losing-top-talent-at-the-interview-stage": {
                fileKey:
                    "Business & Entrepreneurship/Guide/Stop Losing Top Talent at the Interview Stage - Guide.pdf"
            },

            "the-30-day-lean-launch-plan": {
                fileKey:
                    "Business & Entrepreneurship/Guide/The 30-Day Lean Launch Plan - Guide.pdf"
            },

            "the-four-beat-vendor-renegotiation-script": {
                fileKey:
                    "Business & Entrepreneurship/Guide/The Four-Beat Vendor Renegotiation Script - Guide.pdf"
            },

            "the-structured-interview-playbook": {
                fileKey:
                    "Business & Entrepreneurship/Guide/The Structured Interview Playbook - Guide.pdf"
            },

            "the-three-number-pricing-formula": {
                fileKey:
                    "Business & Entrepreneurship/Guide/The Three-Number Pricing Formula - Guide.pdf"
            },

            "the-weekend-cash-control-setup": {
                fileKey:
                    "Business & Entrepreneurship/Guide/The Weekend Cash Control Setup - Guide.pdf"
            },

            "7-branding-errors-hidden-in-your-company-merchandise": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Branding Errors Hidden in Your Company Merchandise - Listicle.pdf"
            },

            "7-business-model-blind-spots-that-kill-startups": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Business Model Blind Spots That Kill Startups - Listicle.pdf"
            },

            "7-cash-flow-mistakes-that-sink-profitable-businesses": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Cash Flow Mistakes That Sink Profitable Businesses - Listicle.pdf"
            },

            "7-cost-cuts-that-save-cash-now-and-bleed-profit-later": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Cost Cuts That Save Cash Now and Bleed Profit Later - Listicle.pdf"
            },

            "7-critical-mistakes-that-sabotage-most-swot-analyses": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Critical Mistakes That Sabotage Most SWOT Analyses - Listicle.pdf"
            },

            "7-mistakes-that-keep-agencies-stuck-in-chaos-and-burnout": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Mistakes That Keep Agencies Stuck in Chaos and Burnout - Listicle.pdf"
            },

            "7-passive-income-lies-that-cost-first-time-builders-20000": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Passive Income Lies That Cost First-Time Builders $20,000 - Listicle.pdf"
            },

            "7-workplace-policies-that-accidentally-block-neurodivergent-talent": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Workplace Policies That Accidentally Block Neurodivergent Talent - Listicle.pdf"
            },

            "12-fatal-mistakes-that-kill-workshop-success": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/12 Fatal Mistakes That Kill Workshop Success - Listicle.pdf"
            },

            "12-merchandise-secrets-that-break-the-rules-and-win-big": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/12 Merchandise Secrets That Break the Rules and Win Big - Listicle.pdf"
            },

            "13-cash-bridge-moves-every-freelancer-needs-before-their-next-net-30-wait": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/13 Cash Bridge Moves Every Freelancer Needs Before Their Next Net-30 Wait - Listicle.pdf"
            },

            "13-signals-your-personal-brand-needs-a-strategic-refresh": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/13 Signals Your Personal Brand Needs a Strategic Refresh - Listicle.pdf"
            },

            "13-visual-decisions-that-separate-professional-brands-from-amateur-ones": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/13 Visual Decisions That Separate Professional Brands From Amateur Ones - Listicle.pdf"
            },

            "21-business-model-checks-investors-expect-you-to-pass": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/21 Business Model Checks Investors Expect You to Pass - Listicle.pdf"
            },

            "21-money-traps-that-kill-first-time-businesses-before-they-start": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/21 Money Traps That Kill First-Time Businesses Before They Start - Listicle.pdf"
            },

            "21-objections-that-actually-mean-they-want-to-buy": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/21 Objections That Actually Mean They Want to Buy - Listicle.pdf"
            },

            "21-reasons-why-you-keep-losing-candidates-to-your-competitors": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/21 Reasons Why You Keep Losing Candidates to Your Competitors - Listicle.pdf"
            },

            "21-workshop-secrets-that-create-consistent-revenue": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/21 Workshop Secrets That Create Consistent Revenue - Listicle.pdf"
            },

            "agency-transformation-assistant": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Agency Transformation Assistant - Prompts.pdf"
            },

            "build-your-high-ticket-service-business": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Build Your High-Ticket Service Business - Prompts.pdf"
            },

            "control-your-business-cash-flow": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Control Your Business Cash Flow - Prompts.pdf"
            },

            "create-professional-visual-identity": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Create Professional Visual Identity - Prompts.pdf"
            },

            "first-time-entrepreneurs-launch-assistant": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/First-Time Entrepreneurs Launch Assistant - Prompts.pdf"
            },

            "mastering-confident-sales-closing": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Mastering Confident Sales Closing - Prompts.pdf"
            },

            "neuroinclusive-leadership-copilot": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Neuroinclusive Leadership Copilot - Prompts.pdf"
            },

            "passive-income-build-systematize": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Passive Income Build & Systematize - Prompts.pdf"
            },

            "strategic-brand-evolution": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Strategic Brand Evolution - Prompts.pdf"
            },

            "strategic-cost-reduction": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Strategic Cost Reduction - Prompts.pdf"
            },

            "strategic-planning-assistant": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Strategic Planning Assistant - Prompts.pdf"
            },

            "talent-acquisition-assistant": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/Talent Acquisition Assistant - Prompts.pdf"
            },

            "the-e-commerce-store-architect": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/The E-Commerce Store Architect - Prompts.pdf"
            },

            "the-freelancers-fast-cash-strategies": {
                fileKey:
                    "Business & Entrepreneurship/Prompts/The Freelancer’s Fast Cash Strategies - Prompts.pdf"
            },

            "agency-operations-and-scaling": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Agency Operations & Scaling - Toolstack.pdf"
            },

            "build-positive-digital-presence": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Build Positive Digital Presence - Toolstack.pdf"
            },

            "confidently-close-every-call": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Confidently Close Every Call - Toolstack.pdf"
            },

            "crafting-irresistible-business-offers": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Crafting Irresistible Business Offers - Toolstack.pdf"
            },

            "digital-creator’s-buddy": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Digital Creator's Buddy - Toolstack.pdf"
            },

            "high-ticket-affiliate-marketing": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/High-Ticket Affiliate Marketing - Toolstack.pdf"
            },

            "how-to-build-a-website": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/How to Build a Website - Toolstack.pdf"
            },

            "marketing-plan-simplified": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Marketing Plan Simplified - Toolstack.pdf"
            },

            "microsaas-success-blueprint": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/MicroSaas Success Blueprint - Toolstack.pdf"
            },

            "power-up-your-brand": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Power Up Your Brand - Toolstack.pdf"
            },

            "sell-with-design": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Sell With Design - Toolstack.pdf"
            },

            "the-power-of-prototypes": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/The Power of Prototypes - Toolstack.pdf"
            },

            "understanding-business-metrics": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Understanding Business Metrics - Toolstack.pdf"
            },

            "validate-business-ideas": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Validate Business Ideas - Toolstack.pdf"
            },

            "winning-product-research": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Winning Product Research - Toolstack.pdf"
            },

            "your-business-plan-playbook": {
                fileKey:
                    "Business & Entrepreneurship/Toolstack/Your Business Plan Playbook - Toolstack.pdf"
            },,,

            "7-conversion-killers-hiding-on-your-product-pages": {
                fileKey:
                    "Business & Entrepreneurship/Listicle/7 Conversion Killers Hiding on Your Product Pages - Listicle.pdf"
            },

            "beyond-the-side-hustle": {
                fileKey:
                    "Business & Entrepreneurship/Podcast/Beyond the Side Hustle - Podcast.pdf"
            },

            "business-cash-control": {
                fileKey:
                    "Business & Entrepreneurship/Podcast/Business Cash Control - Podcast.pdf"
            },

            "cost-control-that-compounds": {
                fileKey:
                    "Business & Entrepreneurship/Podcast/Cost Control That Compounds - Podcast.pdf"
            },

            "fast-cash-freelancer": {
                fileKey:
                    "Business & Entrepreneurship/Podcast/Fast Cash Freelancer - Podcast.pdf"
            },

            "hiring-without-regret": {
                fileKey:
                    "Business & Entrepreneurship/Podcast/Hiring Without Regret - Podcast.pdf"
            },

            "stores-that-convert": {
                fileKey:
                    "Business & Entrepreneurship/Podcast/Stores That Convert - Podcast.pdf"
            },

            "the-brain-friendly-workplace": {
                fileKey:
                    "Business & Entrepreneurship/Podcast/The Brain-Friendly Workplace - Podcast.pdf"
            },

            "the-entrepreneur-starting-line": {
                fileKey:
                    "Business & Entrepreneurship/Podcast/The Entrepreneur Starting Line - Podcast.pdf"
            },

            "the-scalable-expert-model": {
                fileKey:
                    "Business & Entrepreneurship/Podcast/The Scalable Expert Model - Podcast.pdf"
            },,
        };


        // -------------------------------------------------
        // VALIDATE PRODUCT
        // -------------------------------------------------

        const product =
            products[productId];

        if (!product) {

            return context.res.json(
                {
                    success: false,

                    message:
                        "Product not found."
                },
                404
            );
        }


        // -------------------------------------------------
        // GET CURRENT USER
        // -------------------------------------------------

        const userResponse =
            await appwriteRequest(
                "/tablesdb/" +
                databaseId +
                "/tables/" +
                userTableId +
                "/rows/" +
                encodeURIComponent(userId),

                "GET"
            );


        if (!userResponse.ok) {

            return context.res.json(
                {
                    success: false,

                    message:
                        "Unable to load user data."
                },
                500
            );
        }


        const userData =
            userResponse.data;


        // -------------------------------------------------
        // READ UNLOCKED PRODUCTS
        // -------------------------------------------------

        let unlockedProducts = [];

        try {

            unlockedProducts =
                userData.unlockedProducts
                    ? JSON.parse(
                        userData.unlockedProducts
                    )
                    : [];

        } catch (error) {

            unlockedProducts = [];
        }


        // -------------------------------------------------
        // CHECK OWNERSHIP
        // -------------------------------------------------

        if (
            !Array.isArray(unlockedProducts) ||
            !unlockedProducts.includes(productId)
        ) {

            return context.res.json(
                {
                    success: false,

                    message:
                        "Product has not been purchased."
                },
                403
            );
        }


        // -------------------------------------------------
        // CREATE TEMPORARY B2 DOWNLOAD URL
        // -------------------------------------------------

        const command =
            new GetObjectCommand({
                Bucket:
                    process.env.B2_BUCKET_NAME,

                Key:
                    product.fileKey
            });


        const downloadUrl =
            await getSignedUrl(
                b2Client,
                command,
                {
                    expiresIn:
                        300
                }
            );


        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        return context.res.json(
            {
                success: true,

                productId:
                    productId,

                downloadUrl:
                    downloadUrl
            }
        );

    } catch (error) {

        console.error(
            "Get product download URL error:",
            error
        );

        return context.res.json(
            {
                success: false,

                message:
                    "Unable to create download URL."
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
