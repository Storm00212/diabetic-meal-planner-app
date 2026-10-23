import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';

import { MedicalDisclaimer } from '@/shared/components/MedicalDisclaimer';
import { WeightTracker } from './WeightTracker';
import { AskGlucoPlate } from './AskGlucoPlate';
import { Icons } from '@/shared/components/Icons';
import ConfettiCannon from 'react-native-confetti-cannon';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export default function HealthHub() {
  const [showCelebration, setShowCelebration] = useState(false);

  const triggerCelebration = () => {
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 5000);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="p-4 space-y-8">
        <View className="flex-row justify-between items-end">
          <View>
            <Text className="text-3xl font-bold text-slate-900">Health Hub</Text>
            <Text className="text-slate-500">Your biometric tracking and medical support center.</Text>
          </View>
          <TouchableOpacity
            onPress={triggerCelebration}
            className="p-2"
          >
            <Text className="text-xs text-teal-600 font-medium">Test Celebration</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row flex-wrap justify-between gap-6">
          <View className="w-[48%]">
            <WeightTracker />
          </View>
          <View className="w-[48%]">
            <AskGlucoPlate />
          </View>
        </View>

        <View className="bg-teal-50 rounded-2xl p-6 border border-teal-100">
          <Text className="text-lg font-semibold text-teal-900 mb-2">Health Tips</Text>
          <Text className="text-sm text-teal-800 leading-relaxed">
            Consistency is key. Try to log your weight every Monday morning for the most accurate trends.
            Remember to coordinate your carb targets with your healthcare provider.
          </Text>
          <MedicalDisclaimer />
        </View>

        {showCelebration && (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40"
          >
            <View className="bg-white rounded-3xl p-8 shadow-2xl border-4 border-teal-500 items-center">
              <Icons.star size={48} strokeWidth={2} />
              <Text className="text-3xl font-bold text-slate-900 text-center">Congratulations!</Text>
              <Text className="text-slate-600 text-center">You&apos;ve completed your meal plan for the day!</Text>
              <ConfettiCannon count={200} origin={{x: -10, y: 0}} fadeOut={true} />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}