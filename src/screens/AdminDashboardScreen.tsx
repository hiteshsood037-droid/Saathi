import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "../theme";
import {
  getAdminMetrics,
  getVerificationQueue,
  getReportedUsers,
  getUserManagementList,
  banUser,
  unbanUser,
  approveVerification,
  rejectVerification,
  resolveReport,
} from "../services/api";
import { Profile, Report, SubscriptionTier } from "../types";

// Types for Admin Dashboard
interface AdminMetrics {
  totalUsers: number;
  dailyActiveUsers: number;
  subscriptionRevenue: number;
  pendingVerifications: number;
  pendingReports: number;
  premiumUsers: number;
  goldUsers: number;
  revenueHistory: Array<{ date: string; amount: number }>;
}

type ReportedUserItem = Report & { reportedProfile: Profile; reporterProfile: Profile };

const AdminDashboardScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [verificationQueue, setVerificationQueue] = useState<Profile[]>([]);
  const [reportedUsers, setReportedUsers] = useState<ReportedUserItem[]>([]);
  const [userList, setUserList] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals state
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [m, vq, ru, ul] = await Promise.all([
        getAdminMetrics(),
        getVerificationQueue(),
        getReportedUsers(),
        getUserManagementList(),
      ]);
      setMetrics(m);
      setVerificationQueue(vq);
      setReportedUsers(ru);
      setUserList(ul);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    const filtered = await getUserManagementList(query);
    setUserList(filtered);
  };

  const handleApprove = async (userId: string) => {
    await approveVerification(userId);
    setVerificationQueue((prev) => prev.filter((p) => p.id !== userId));
    Alert.alert("Success", "User verified successfully");
  };

  const handleReject = async (userId: string) => {
    await rejectVerification(userId);
    setVerificationQueue((prev) => prev.filter((p) => p.id !== userId));
    Alert.alert("Rejected", "Verification request rejected");
  };

  const handleBan = async () => {
    if (!selectedUser) return;
    await banUser(selectedUser.id);
    setBanModalVisible(false);
    setBanReason("");
    setSelectedUser(null);
    fetchData(); // Refresh to show banned status
    Alert.alert("Success", "User has been banned");
  };

  const handleUnban = async (userId: string) => {
    await unbanUser(userId);
    fetchData();
    Alert.alert("Success", "User has been unbanned");
  };

  const renderMetricCard = (label: string, value: string | number, color: string) => (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Operations Hub...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={Typography.h2}>Operations Hub</Text>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>ADMIN PANEL</Text>
          </View>
        </View>
        <TouchableOpacity onPress={fetchData} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Overview Cards */}
        <View style={styles.metricsRow}>
          {renderMetricCard("Total Users", metrics?.totalUsers || 0, Colors.primary)}
          {renderMetricCard("DAU", metrics?.dailyActiveUsers || 0, Colors.success)}
        </View>
        <View style={styles.metricsRow}>
          {renderMetricCard("Banned", 124, Colors.error)}
          {renderMetricCard("Pending Reports", metrics?.pendingReports || 0, Colors.warning)}
        </View>

        {/* Analytics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analytics & Revenue</Text>
          <View style={styles.analyticsCard}>
            <View style={styles.revenueRow}>
              <View>
                <Text style={styles.revenueLabel}>Estimated MRR</Text>
                <Text style={styles.revenueValue}>${metrics?.subscriptionRevenue.toLocaleString()}</Text>
              </View>
              <View style={styles.subBreakdown}>
                <View style={styles.subItem}>
                  <View style={[styles.subDot, { backgroundColor: Colors.accent }]} />
                  <Text style={styles.subText}>Premium: {metrics?.premiumUsers}</Text>
                </View>
                <View style={styles.subItem}>
                  <View style={[styles.subDot, { backgroundColor: Colors.gold }]} />
                  <Text style={styles.subText}>Gold: {metrics?.goldUsers}</Text>
                </View>
              </View>
            </View>
            
            {/* Simple Revenue Graph Mockup */}
            <View style={styles.chartContainer}>
              {metrics?.revenueHistory.map((item, index) => (
                <View key={item.date} style={styles.chartBarContainer}>
                  <View 
                    style={[
                      styles.chartBar, 
                      { height: (item.amount / 5000) * 100 }
                    ]} 
                  />
                  <Text style={styles.chartLabel}>{item.date}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Verification Queue */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Verification Queue</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{verificationQueue.length}</Text>
            </View>
          </View>
          
          {verificationQueue.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No pending verifications</Text>
            </View>
          ) : (
            verificationQueue.map((user) => (
              <View key={user.id} style={styles.listItem}>
                <Image source={{ uri: user.photos[0] }} style={styles.listAvatar} />
                <View style={styles.listInfo}>
                  <Text style={styles.listName}>{user.full_name}</Text>
                  <Text style={styles.listSubtext}>Selfie verification pending</Text>
                </View>
                <View style={styles.listActions}>
                  <TouchableOpacity 
                    onPress={() => handleReject(user.id)}
                    style={[styles.actionBtn, styles.rejectBtn]}
                  >
                    <Text style={styles.actionBtnText}>✕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => handleApprove(user.id)}
                    style={[styles.actionBtn, styles.approveBtn]}
                  >
                    <Text style={styles.actionBtnText}>✓</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Reported Users */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reported Users</Text>
            <View style={[styles.countBadge, { backgroundColor: Colors.error }]}>
              <Text style={styles.countBadgeText}>{reportedUsers.length}</Text>
            </View>
          </View>

          {reportedUsers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No active reports</Text>
            </View>
          ) : (
            reportedUsers.map((report) => (
              <View key={report.id} style={styles.listItem}>
                <View style={styles.listInfo}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.listName}>{report.reportedProfile.full_name}</Text>
                    <View style={styles.reportReasonBadge}>
                      <Text style={styles.reportReasonText}>{report.reason}</Text>
                    </View>
                  </View>
                  <Text style={styles.listSubtext}>
                    Reported by {report.reporterProfile.full_name} • {new Date(report.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedUser(report.reportedProfile)}
                  style={styles.viewBtn}
                >
                  <Text style={styles.viewBtnText}>View</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* User Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User & Ban Management</Text>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search users by name, role, or location..."
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>

          {userList.map((user) => (
            <TouchableOpacity 
              key={user.id} 
              style={styles.listItem}
              onPress={() => setSelectedUser(user)}
            >
              <Image source={{ uri: user.photos[0] }} style={styles.listAvatar} />
              <View style={styles.listInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.listName}>{user.full_name}</Text>
                  {user.is_banned && (
                    <View style={styles.bannedBadge}>
                      <Text style={styles.bannedBadgeText}>BANNED</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.listSubtext}>
                  {user.subscription_tier} • {user.location_name}
                </Text>
              </View>
              <View style={styles.tierIndicator}>
                <Text style={[
                  styles.tierText,
                  { color: user.subscription_tier === "Gold" ? Colors.gold : user.subscription_tier === "Premium" ? Colors.primary : Colors.textTertiary }
                ]}>
                  {user.subscription_tier === "Free" ? "○" : "●"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* User Details Modal */}
      <Modal
        visible={!!selectedUser}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedUser && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={Typography.h3}>User Details</Text>
                  <TouchableOpacity onPress={() => setSelectedUser(null)}>
                    <Text style={styles.closeModalText}>Close</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  <View style={styles.modalUserInfo}>
                    <Image source={{ uri: selectedUser.photos[0] }} style={styles.modalAvatar} />
                    <Text style={styles.modalUserName}>{selectedUser.full_name}</Text>
                    <Text style={styles.modalUserTier}>{selectedUser.subscription_tier} Member</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <DetailRow label="Location" value={selectedUser.location_name} />
                    <DetailRow label="Occupation" value={selectedUser.occupation || "Not specified"} />
                    <DetailRow label="Verification" value={selectedUser.verification_status.toUpperCase()} />
                    <DetailRow label="Banned" value={selectedUser.is_banned ? "YES" : "NO"} />
                    <DetailRow label="Reports" value="2" />
                    <DetailRow label="IP Address" value="192.168.1.45" />
                    <DetailRow label="Device ID" value="iPhone14,2-AB93-421" />
                  </View>

                  <View style={styles.modalActions}>
                    {selectedUser.is_banned ? (
                      <TouchableOpacity 
                        style={[styles.modalActionBtn, styles.unbanActionBtn]}
                        onPress={() => handleUnban(selectedUser.id)}
                      >
                        <Text style={styles.modalActionBtnText}>UNBAN USER</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={[styles.modalActionBtn, styles.banActionBtn]}
                        onPress={() => setBanModalVisible(true)}
                      >
                        <Text style={styles.modalActionBtnText}>BAN USER</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Ban Reason Modal */}
      <Modal
        visible={banModalVisible}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.banModalContent}>
            <Text style={styles.banModalTitle}>Ban User</Text>
            <Text style={styles.banModalSubtitle}>
              Are you sure you want to ban {selectedUser?.full_name}? This will restrict their access immediately.
            </Text>
            
            <TextInput
              style={styles.banReasonInput}
              placeholder="Reason for ban (e.g., Harassment, Fake profile)..."
              multiline
              value={banReason}
              onChangeText={setBanReason}
            />

            <View style={styles.banModalActions}>
              <TouchableOpacity 
                style={styles.cancelBanBtn}
                onPress={() => setBanModalVisible(false)}
              >
                <Text style={styles.cancelBanText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBanBtn, !banReason && { opacity: 0.5 }]}
                onPress={handleBan}
                disabled={!banReason}
              >
                <Text style={styles.confirmBanText}>Confirm Ban</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    ...Typography.body,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...Shadows.sm,
  },
  adminBadge: {
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  adminBadgeText: {
    color: Colors.white || "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    color: Colors.primary,
    fontWeight: "600",
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  metricCard: {
    flex: 0.48,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    ...Shadows.sm,
  },
  metricLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    ...Typography.h3,
    fontWeight: "800",
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  analyticsCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  revenueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  revenueLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  revenueValue: {
    ...Typography.h2,
    color: Colors.success,
  },
  subBreakdown: {
    alignItems: "flex-end",
  },
  subItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  subDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  subText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  chartContainer: {
    flexDirection: "row",
    height: 120,
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  chartBarContainer: {
    alignItems: "center",
    width: "12%",
  },
  chartBar: {
    width: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 4,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
    marginBottom: Spacing.md,
  },
  countBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  listItem: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    alignItems: "center",
    ...Shadows.sm,
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.md,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
  },
  listSubtext: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  listActions: {
    flexDirection: "row",
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  approveBtn: {
    backgroundColor: Colors.success + "20",
  },
  rejectBtn: {
    backgroundColor: Colors.error + "20",
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: Colors.backgroundDark,
  },
  viewBtnText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Colors.primary,
  },
  emptyCard: {
    backgroundColor: Colors.backgroundDark,
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  emptyText: {
    color: Colors.textTertiary,
    ...Typography.bodySmall,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  reportReasonBadge: {
    backgroundColor: Colors.error + "15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  reportReasonText: {
    color: Colors.error,
    fontSize: 10,
    fontWeight: "700",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: Colors.textPrimary,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bannedBadge: {
    backgroundColor: Colors.error,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 8,
  },
  bannedBadgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "800",
  },
  tierIndicator: {
    paddingLeft: 8,
  },
  tierText: {
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  closeModalText: {
    color: Colors.textTertiary,
    fontWeight: "600",
  },
  modalScroll: {
    flex: 1,
  },
  modalUserInfo: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: Spacing.md,
  },
  modalUserName: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  modalUserTier: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  detailSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  detailValue: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  modalActions: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xxl,
  },
  modalActionBtn: {
    height: 50,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  banActionBtn: {
    backgroundColor: Colors.error,
  },
  unbanActionBtn: {
    backgroundColor: Colors.success,
  },
  modalActionBtnText: {
    color: "#FFF",
    fontWeight: "800",
    letterSpacing: 1,
  },
  banModalContent: {
    backgroundColor: Colors.surface,
    margin: Spacing.xl,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
  },
  banModalTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  banModalSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  banReasonInput: {
    backgroundColor: Colors.backgroundDark,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    height: 100,
    textAlignVertical: "top",
    ...Typography.bodySmall,
    marginBottom: Spacing.xl,
  },
  banModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cancelBanBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginRight: Spacing.md,
  },
  cancelBanText: {
    color: Colors.textTertiary,
    fontWeight: "600",
  },
  confirmBanBtn: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  confirmBanText: {
    color: "#FFF",
    fontWeight: "700",
  },
});

export default AdminDashboardScreen;
