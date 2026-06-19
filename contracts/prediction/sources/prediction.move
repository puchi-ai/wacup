/// World Cup 2026 — On-Chain Prediction Contract
///
/// Users place predictions on-chain, minting PredictionRecord NFTs.
/// Match results are indexed for verifiable history.
/// AdminCap holder manages match results and resolution.
module worldcup_predictor::prediction {

    // =========================================================================
    // Imports
    // =========================================================================
    use sui::event;
    use std::string::{Self, String};

    // =========================================================================
    // Error Codes
    // =========================================================================
    /// Choice must be 0 (home), 1 (draw), or 2 (away)
    const EInvalidChoice: u64 = 0;

    // =========================================================================
    // Admin Capability
    // =========================================================================
    /// Required for admin functions (record match results, resolve predictions).
    public struct AdminCap has key, store { id: UID }

    // =========================================================================
    // Market Configuration (Shared Object)
    // =========================================================================
    /// Tracks prediction count. Created at init.
    public struct PredictionMarket has key {
        id: UID,
        /// Total predictions placed across all users
        prediction_count: u64,
    }

    // =========================================================================
    // Prediction Record (Owned by user)
    // =========================================================================
    /// Minted to the predictor. Proves their on-chain forecast.
    public struct PredictionRecord has key, store {
        id: UID,
        predictor: address,
        match_id: String,
        choice: u8,           // 0 = home, 1 = draw, 2 = away
        is_resolved: bool,
        was_correct: bool,
    }

    // =========================================================================
    // Match Result (Shared Object)
    // =========================================================================
    /// Indexed by admin after match completion for on-chain history.
    public struct MatchResult has key, store {
        id: UID,
        match_id: String,
        home_team: String,
        away_team: String,
        home_score: u8,
        away_score: u8,
        competition: String,
        recorded_at: u64,     // epoch ms
    }

    // =========================================================================
    // Events
    // =========================================================================
    public struct PredictionPlaced has copy, drop {
        predictor: address,
        match_id: String,
        choice: u8,
        record_id: ID,
    }

    public struct PredictionResolved has copy, drop {
        record_id: ID,
        predictor: address,
        match_id: String,
        was_correct: bool,
    }

    public struct MatchResultRecorded has copy, drop {
        match_id: String,
        home_team: String,
        away_team: String,
        home_score: u8,
        away_score: u8,
    }

    // =========================================================================
    // String Clone Helper
    // =========================================================================
    /// Sui Move String doesn't implement Clone, so we use bytes round-trip.
    fun clone_string(s: &String): String {
        string::utf8(*string::as_bytes(s))
    }

    // =========================================================================
    // Init
    // =========================================================================
    /// Creates AdminCap (→ publisher) + shared PredictionMarket.
    fun init(ctx: &mut TxContext) {
        let publisher = tx_context::sender(ctx);

        transfer::transfer(AdminCap { id: object::new(ctx) }, publisher);

        transfer::share_object(PredictionMarket {
            id: object::new(ctx),
            prediction_count: 0,
        });
    }

    // =========================================================================
    // Public — Place Prediction
    // =========================================================================
    /// Place an on-chain prediction. A PredictionRecord NFT is minted to the caller.
    #[allow(lint(self_transfer))]
    public fun place_prediction(
        market: &mut PredictionMarket,
        match_id: String,
        choice: u8,
        ctx: &mut TxContext,
    ) {
        assert!(choice <= 2, EInvalidChoice);

        let sender = tx_context::sender(ctx);
        market.prediction_count = market.prediction_count + 1;

        // Clone match_id for event before moving into record
        let mid_for_event = clone_string(&match_id);

        // Mint record
        let record = PredictionRecord {
            id: object::new(ctx),
            predictor: sender,
            match_id,
            choice,
            is_resolved: false,
            was_correct: false,
        };
        let record_id = object::id(&record);
        transfer::transfer(record, sender);

        event::emit(PredictionPlaced {
            predictor: sender,
            match_id: mid_for_event,
            choice,
            record_id,
        });
    }

    // =========================================================================
    // Admin — Record Match Result
    // =========================================================================
    /// Index a completed match on-chain.
    public fun record_match_result(
        _: &AdminCap,
        match_id: String,
        home_team: String,
        away_team: String,
        home_score: u8,
        away_score: u8,
        competition: String,
        ctx: &mut TxContext,
    ) {
        let mid_event   = clone_string(&match_id);
        let ht_event    = clone_string(&home_team);
        let at_event    = clone_string(&away_team);

        transfer::share_object(MatchResult {
            id: object::new(ctx),
            match_id,
            home_team,
            away_team,
            home_score,
            away_score,
            competition,
            recorded_at: tx_context::epoch_timestamp_ms(ctx),
        });

        event::emit(MatchResultRecorded {
            match_id: mid_event,
            home_team: ht_event,
            away_team: at_event,
            home_score,
            away_score,
        });
    }

    // =========================================================================
    // Admin — Resolve Prediction
    // =========================================================================
    /// Mark a PredictionRecord as resolved and record correctness.
    public fun resolve_prediction(
        _: &AdminCap,
        record: &mut PredictionRecord,
        was_correct: bool,
    ) {
        record.is_resolved = true;
        record.was_correct = was_correct;

        event::emit(PredictionResolved {
            record_id: object::id(record),
            predictor: record.predictor,
            match_id: clone_string(&record.match_id),
            was_correct,
        });
    }

    // =========================================================================
    // Getters
    // =========================================================================
    /// Returns total prediction count.
    public fun prediction_count(market: &PredictionMarket): u64 {
        market.prediction_count
    }
}
