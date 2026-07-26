import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import feedService, { Feed } from '../services/feedService';
import { AppColors } from '../theme/colors';

interface FeedPollWidgetProps {
  feed: Feed;
  onVoteSuccess?: () => void;
}

interface PollOptionResult {
  vote_count: number;
  unique_voters?: number;
  percentage: number;
}

export const FeedPollWidget: React.FC<FeedPollWidgetProps> = ({ feed, onVoteSuccess }) => {
  const [pollResults, setPollResults] = useState<Record<string, PollOptionResult> | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [userVotes, setUserVotes] = useState<number[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadPollResults = async () => {
    setIsLoading(true);
    try {
      const data = await feedService.getPollResults(feed.id);
      if (data) {
        const resultsData = data.results || {};
        setPollResults(resultsData.results || {});
        setTotalVotes(resultsData.total_votes || 0);
        setUserVotes(data.user_votes || []);
        setHasVoted(data.user_votes && data.user_votes.length > 0);
        
        const expired = data.expires_at ? new Date(data.expires_at) < new Date() : false;
        setIsExpired(expired || !!data.is_expired);
      }
    } catch (e) {
      console.error('Error loading poll results in widget:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPollResults();
  }, [feed.id]);

  const handleVotePoll = async (optionIndex: number) => {
    if (hasVoted || isExpired || isLoading) return;
    setIsLoading(true);
    try {
      const result = await feedService.votePoll(feed.id, optionIndex);
      if (result.success) {
        const resultsData = result.pollResults || {};
        setPollResults(resultsData.results || {});
        setTotalVotes(resultsData.total_votes || 0);
        setUserVotes(result.userVotes || [optionIndex]);
        setHasVoted(true);
        if (onVoteSuccess) {
          onVoteSuccess();
        }
      } else {
        Alert.alert('Failed', result.message || 'Failed to submit vote.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!feed.poll_options || feed.poll_options.length === 0) {
    return null;
  }

  const showResults = isExpired || hasVoted;

  return (
    <View style={styles.pollCard}>
      <View style={styles.pollHeader}>
        <Text style={styles.pollTitle}>
          📊 Ekenox Poll {isExpired ? '(Closed)' : ''}
        </Text>
        {isLoading && <ActivityIndicator size="small" color={AppColors.primary} />}
      </View>

      {feed.poll_options.map((option, idx) => {
        const results = pollResults || {};
        const optionKey = idx.toString();
        const optionData = results[optionKey] || results[idx] || null;
        
        const votesCount = optionData?.vote_count ?? 0;
        const percentage = optionData ? Math.round(Number(optionData.percentage)) : 0;
        
        const userVotedThis = userVotes.includes(idx);

        return (
          <TouchableOpacity
            key={idx}
            style={[
              styles.pollOptionBtn,
              userVotedThis ? styles.pollOptionVoted : null,
              showResults ? styles.pollOptionDisabled : null
            ]}
            onPress={() => handleVotePoll(idx)}
            disabled={showResults || isLoading}
            activeOpacity={0.7}
          >
            {showResults && (
              <View style={[styles.pollProgressFill, { width: `${percentage}%` }]} />
            )}
            <View style={styles.pollOptionContent}>
              <Text style={[
                styles.pollOptionText, 
                userVotedThis ? styles.pollOptionTextVoted : null
              ]}>
                {option}
              </Text>
              {showResults && (
                <Text style={styles.pollPercentText}>{percentage}% ({votesCount})</Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.pollFooter}>
        <Text style={styles.totalVotesText}>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </Text>
        {feed.poll_expires_at && (
          <Text style={styles.expiryText}>
            Expires: {new Date(feed.poll_expires_at).toLocaleDateString()}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pollCard: {
    backgroundColor: '#F8FFFE',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D4EDDA',
    marginVertical: 8,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pollTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  pollOptionBtn: {
    width: '100%',
    height: 44,
    borderWidth: 1.5,
    borderColor: '#C8E6C9',
    borderRadius: 8,
    marginVertical: 4,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  pollOptionVoted: {
    borderColor: AppColors.primary,
  },
  pollOptionDisabled: {
    backgroundColor: '#FAFDFB',
  },
  pollProgressFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#E8F5E9',
  },
  pollOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    width: '100%',
  },
  pollOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textDark,
    flex: 1,
  },
  pollOptionTextVoted: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  pollPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textMedium,
  },
  pollFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  totalVotesText: {
    fontSize: 11,
    color: AppColors.textLight,
  },
  expiryText: {
    fontSize: 11,
    color: AppColors.textLight,
  },
});
