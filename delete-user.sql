-- Function to remove a user completely by userid
CREATE OR REPLACE FUNCTION remove_user(target_userid TEXT) RETURNS VOID AS $$
BEGIN
    -- Remove related records from other tables in the correct order

    -- 1. Remove from highscore_games first
    DELETE FROM highscore_games WHERE userid = target_userid;

    -- 2. Remove associated game_data for the user's games
    DELETE FROM game_data 
    WHERE game_id IN (SELECT id FROM games WHERE userid = target_userid);

    -- 3. Remove the user's games
    DELETE FROM games WHERE userid = target_userid;

    -- 4. Remove from activities
    DELETE FROM activities WHERE userid = target_userid;

    -- 5. Remove from events
    DELETE FROM events WHERE userid = target_userid;

    -- 6. Remove from logs
    DELETE FROM logs WHERE userid = target_userid;

    -- 7. Remove from friends (both sides of friendship)
    DELETE FROM friends 
    WHERE userid1 = target_userid OR userid2 = target_userid;

    -- 8. Remove from password_users (if applicable)
    DELETE FROM password_users WHERE userid = target_userid;

    -- 9. Finally, remove the user from the users table
    DELETE FROM users WHERE userid = target_userid;
END;
$$ LANGUAGE plpgsql;

SELECT remove_user('[user-to-remove]');