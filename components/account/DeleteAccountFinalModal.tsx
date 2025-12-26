import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DeleteAccountFinalModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function DeleteAccountFinalModal({
  visible,
  onCancel,
  onConfirm,
  isLoading,
}: DeleteAccountFinalModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Ionicons name="alert-circle-outline" size={64} color="#dc2626" style={styles.icon} />
            <Text style={styles.title}>Are You Absolutely Sure?</Text>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>This is your last chance to cancel.</Text>
            <Text style={styles.warningText}>
              Your account and all data will be permanently deleted and cannot be recovered.
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.cancelButton, isLoading && styles.buttonDisabled]}
              onPress={onCancel}
              disabled={isLoading}
              accessibilityLabel="Cancel account deletion"
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmButton, isLoading && styles.buttonDisabled]}
              onPress={onConfirm}
              disabled={isLoading}
              accessibilityLabel="Confirm account deletion permanently"
              accessibilityRole="button"
              accessibilityHint="This action cannot be undone"
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Yes, Delete My Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#7f1d1d',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
