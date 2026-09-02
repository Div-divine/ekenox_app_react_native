import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppColors } from '../theme/colors';
import carShareService from '../services/carShareService';
import vehicleService, { Vehicle } from '../services/vehicleService';

export default function CreateCarShareScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { eventId, eventTitle, eventLocation } = route.params;

  // Form states
  const [departureLocation, setDepartureLocation] = useState('');
  const [destinationLocation] = useState(eventLocation);
  const [departureDate, setDepartureDate] = useState<Date>(new Date());
  const [departureTime, setDepartureTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [availableSeats, setAvailableSeats] = useState(3);
  const [pricePerSeat, setPricePerSeat] = useState('0');
  const [notes, setNotes] = useState('');

  // Vehicle states (auto-filled from verified vehicle)
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Preference switches
  const [allowSmoking, setAllowSmoking] = useState(false);
  const [allowPets, setAllowPets] = useState(true);
  const [allowMusic, setAllowMusic] = useState(true);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [userVehicles, setUserVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    const fetchDriverVehicle = async () => {
      setLoading(true);
      try {
        const vehicles = await vehicleService.getVehicles();
        const approved = (vehicles || []).filter(v => v.verificationStatus === 'approved' || v.isVerified);
        
        if (approved.length === 0) {
          Alert.alert(
            'Verification Required 🚗',
            'To offer a car share ride, you must have an approved driver license and at least one validated vehicle.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
              { text: 'Verify Now', onPress: () => navigation.navigate('UserVerification') }
            ]
          );
        } else {
          setUserVehicles(approved);
          const defaultV = approved[0];
          setSelectedVehicle(defaultV);
          setVehicleType(`${defaultV.make} ${defaultV.model}`);
          setVehicleColor(defaultV.color || '');
          setLicensePlate(defaultV.licensePlate);
        }
      } catch (e) {
        console.warn('Error loading driver vehicle:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDriverVehicle();
  }, []);

  const handleSelectVehicle = (v: Vehicle) => {
    setSelectedVehicle(v);
    setVehicleType(`${v.make} ${v.model}`);
    setVehicleColor(v.color || '');
    setLicensePlate(v.licensePlate);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDepartureDate(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      setDepartureTime(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (!departureLocation.trim()) {
      Alert.alert('Required Fields', 'Please enter your departure / pickup location.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = departureDate.toISOString().split('T')[0];
      const formattedTime = departureTime.toTimeString().split(' ')[0]; // HH:MM:SS

      const payload = {
        event_id: Number(eventId),
        description: `Ride offer for ${eventTitle}`,
        departure_date: formattedDate,
        departure_time: `${formattedDate}T${formattedTime}`, // ISO string format
        departure_location: departureLocation.trim(),
        destination_location: destinationLocation,
        available_seats: availableSeats,
        price_per_seat: parseFloat(pricePerSeat) || 0,
        notes: notes.trim(),
        vehicle_type: vehicleType.trim() || undefined,
        vehicle_color: vehicleColor.trim() || undefined,
        license_plate: licensePlate.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        allow_smoking: allowSmoking,
        allow_pets: allowPets,
        allow_music: allowMusic,
      };

      const res = await carShareService.createCarShare(payload);
      if (res.success) {
        Alert.alert('Success', 'Your ride offer has been successfully posted!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', res.message || 'Failed to create car share.');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  if (userVehicles.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="shield-checkmark-outline" size={64} color={AppColors.primary} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: AppColors.textDark, marginTop: 16 }}>
            Driver Verification Required
          </Text>
          <Text style={{ fontSize: 13, color: AppColors.textMedium, textAlign: 'center', marginHorizontal: 32, marginTop: 8, lineHeight: 18 }}>
            To offer a ride share, you must have a verified driver's license and at least one approved vehicle validated by our admin team.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: AppColors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 28,
              marginTop: 24,
            }}
            onPress={() => navigation.navigate('UserVerification')}
          >
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>Complete Driver Verification</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 16 }} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: '600' }}>Cancel & Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Offer a Ride</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeader}>Ride Schedule</Text>

          {/* Departure */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Departure Location (Pickup Point) *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="location-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Where will you start from?"
                value={departureLocation}
                onChangeText={setDepartureLocation}
              />
            </View>
          </View>

          {/* Destination (Read Only) */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Destination Location</Text>
            <View style={[styles.inputWrapper, styles.readOnlyInput]}>
              <Ionicons name="flag-outline" size={20} color={AppColors.textLight} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: '#9CA3AF' }]} value={destinationLocation} editable={false} />
            </View>
          </View>

          {/* Date & Time selectors */}
          <View style={styles.rowInputs}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Departure Date *</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
                <Text style={styles.datePickerText}>{departureDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Departure Time *</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
                <Text style={styles.datePickerText}>
                  {departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={departureDate}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}

          {showTimePicker && (
            <DateTimePicker value={departureTime} mode="time" display="default" onChange={handleTimeChange} />
          )}

          <Text style={styles.sectionHeader}>Ride Details</Text>

          {/* Seats & Price */}
          <View style={styles.rowInputs}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Available Seats</Text>
              <View style={styles.seatsRow}>
                <TouchableOpacity
                  style={styles.seatBtn}
                  onPress={() => setAvailableSeats(s => Math.max(1, s - 1))}
                >
                  <Ionicons name="remove" size={18} color={AppColors.primary} />
                </TouchableOpacity>
                <Text style={styles.seatVal}>{availableSeats}</Text>
                <TouchableOpacity
                  style={styles.seatBtn}
                  onPress={() => setAvailableSeats(s => Math.min(8, s + 1))}
                >
                  <Ionicons name="add" size={18} color={AppColors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Price per Seat (€)</Text>
              <View style={styles.inputWrapper}>
                <Text style={{ marginRight: 4, fontWeight: '700', color: '#374151' }}>€</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0 (Free)"
                  value={pricePerSeat}
                  onChangeText={setPricePerSeat}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Contact Phone */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contact Phone for Coordination</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Vehicle specifications (pre-filled or selected) */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Select Vehicle for Ride *</Text>
            {userVehicles.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {userVehicles.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => handleSelectVehicle(v)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: selectedVehicle?.id === v.id ? AppColors.primary : '#E5E7EB',
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: selectedVehicle?.id === v.id ? 'white' : '#374151', fontSize: 12, fontWeight: '700' }}>
                      {v.make} {v.model} ({v.licensePlate})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={[styles.inputWrapper, styles.readOnlyInput]}>
              <Ionicons name="car-sport-outline" size={20} color={AppColors.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: '#374151', fontWeight: '600' }]}
                value={`${vehicleColor} ${vehicleType} (${licensePlate})`}
                editable={false}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Driver Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add information about luggage capacity, intermediate stops, etc."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          <Text style={styles.sectionHeader}>Preferences</Text>

          {/* Preferences toggles */}
          <View style={styles.preferencesCard}>
            <View style={styles.preferenceRow}>
              <View style={styles.prefLeft}>
                <Ionicons name="logo-no-smoking" size={18} color="#4B5563" />
                <Text style={styles.prefLabel}>Allow smoking</Text>
              </View>
              <Switch
                value={allowSmoking}
                onValueChange={setAllowSmoking}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={allowSmoking ? AppColors.primary : '#F3F4F6'}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.prefLeft}>
                <Ionicons name="paw" size={18} color="#4B5563" />
                <Text style={styles.prefLabel}>Allow pets</Text>
              </View>
              <Switch
                value={allowPets}
                onValueChange={setAllowPets}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={allowPets ? AppColors.primary : '#F3F4F6'}
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.prefLeft}>
                <Ionicons name="musical-notes" size={18} color="#4B5563" />
                <Text style={styles.prefLabel}>Allow music</Text>
              </View>
              <Switch
                value={allowMusic}
                onValueChange={setAllowMusic}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={allowMusic ? AppColors.primary : '#F3F4F6'}
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Post Ride</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.primary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 16,
    paddingLeft: 2,
  },
  inputContainer: {
    marginBottom: 16,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  readOnlyInput: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#1F2937',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  datePickerText: {
    fontSize: 14,
    color: '#1F2937',
  },
  seatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 8,
  },
  seatBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
  },
  notesInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    textAlignVertical: 'top',
    height: 90,
  },
  preferencesCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prefLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  submitBtn: {
    backgroundColor: AppColors.primary,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
});
