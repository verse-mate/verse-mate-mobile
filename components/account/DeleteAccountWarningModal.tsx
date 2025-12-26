import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DeleteAccountWarningModalProps {
  visible: boolean;
  onCancel: () => void;
  onContinue: () => void;
}

export function DeleteAccountWarningModal({
  visible,
  onCancel,
  onContinue,
}: DeleteAccountWarningModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Ionicons name="warning-outline" size={48} color="#dc2626" style={styles.icon} />
            <Text style={styles.title}>Delete Your Account?</Text>
          </View>

          <Text style={styles.warning}>This action is permanent and cannot be undone.</Text>

          <View style={styles.dataList}>
            <Text style={styles.dataListTitle}>
              The following data will be permanently deleted:
            </Text>

            <View style={styles.dataItem}>
              <Ionicons name="person-outline" size={16} color="#6b7280" />
              <Text style={styles.dataItemText}>Profile information</Text>
            </View>

            <View style={styles.dataItem}>
              <Ionicons name="book-outline" size={16} color="#6b7280" />
              <Text style={styles.dataItemText}>Reading progress and history</Text>
            </View>

            <View style={styles.dataItem}>
              <Ionicons name="create-outline" size={16} color="#6b7280" />
              <Text style={styles.dataItemText}>Notes and highlights</Text>
            </View>

            <View style={styles.dataItem}>
              <Ionicons name="bookmark-outline" size={16} color="#6b7280" />
              <Text style={styles.dataItemText}>Bookmarks and favorites</Text>
            </View>

            <View style={styles.dataItem}>
              <Ionicons name="chatbubble-outline" size={16} color="#6b7280" />
              <Text style={styles.dataItemText}>Chat conversations</Text>
            </View>

            <View style={styles.dataItem}>
              <Ionicons name="settings-outline" size={16} color="#6b7280" />
              <Text style={styles.dataItemText}>All preferences and settings</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              accessibilityLabel="Cancel account deletion"
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={onContinue}
              accessibilityLabel="Continue with account deletion"
              accessibilityRole="button"
            >
              <Text style={styles.continueButtonText}>Continue</Text>
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
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  warning: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  dataList: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  dataListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataItemText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
