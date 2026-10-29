// Ikon PlanCraft: Hugeicons (design system Hijrahfood), dengan nama ekspor yang dulu dipakai dari lucide-react
// supaya pemanggil tidak perlu diubah. Ukuran tetap diatur kelas (w-4 h-4, dst.), stroke 1,75.
import {
  Activity01Icon,
  AddCircleIcon,
  Alert02Icon,
  AlertCircleIcon,
  Analytics01Icon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowUpRight01Icon,
  BalanceScaleIcon,
  Calendar01Icon,
  Calendar03Icon,
  Cancel01Icon,
  ChartHistogramIcon,
  ChartLineData02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CloudUploadIcon,
  ComputerIcon,
  Copy01Icon,
  DashboardSquare01Icon,
  Delete02Icon,
  Download01Icon,
  FilterIcon,
  FireIcon,
  FloppyDiskIcon,
  HardHatIcon,
  InformationCircleIcon,
  Key01Icon,
  LinkSquare02Icon,
  Logout01Icon,
  PackageIcon,
  PlusSignIcon,
  PrinterIcon,
  RefreshIcon,
  Search01Icon,
  SecurityCheckIcon,
  SecurityWarningIcon,
  SmartPhone01Icon,
  SnowIcon,
  SquareLock02Icon,
  Tag01Icon,
  Target02Icon,
  Tick02Icon,
  Undo02Icon,
  Upload01Icon,
  UserIcon,
  ViewIcon,
  ViewOffSlashIcon,
  Xls02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number | string; strokeWidth?: number };

function make(icon: IconSvgElement, displayName: string) {
  function Icon({ size = 24, strokeWidth = 1.75, ...props }: IconProps) {
    return <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} aria-hidden="true" {...props} />;
  }
  Icon.displayName = displayName;
  return Icon;
}

export const Activity = make(Activity01Icon, "Activity");
export const AlertCircle = make(AlertCircleIcon, "AlertCircle");
export const AlertTriangle = make(Alert02Icon, "AlertTriangle");
export const ArrowLeft = make(ArrowLeft02Icon, "ArrowLeft");
export const ArrowRight = make(ArrowRight02Icon, "ArrowRight");
export const ArrowUpRight = make(ArrowUpRight01Icon, "ArrowUpRight");
export const BarChart2 = make(ChartHistogramIcon, "BarChart2");
export const BarChart3 = make(Analytics01Icon, "BarChart3");
export const Boxes = make(PackageIcon, "Boxes");
export const Calendar = make(Calendar03Icon, "Calendar");
export const CalendarDays = make(Calendar01Icon, "CalendarDays");
export const Check = make(Tick02Icon, "Check");
export const CheckCircle2 = make(CheckmarkCircle02Icon, "CheckCircle2");
export const ChevronRight = make(ArrowRight01Icon, "ChevronRight");
export const Clock = make(Clock01Icon, "Clock");
export const Copy = make(Copy01Icon, "Copy");
export const Download = make(Download01Icon, "Download");
export const ExternalLink = make(LinkSquare02Icon, "ExternalLink");
export const Eye = make(ViewIcon, "Eye");
export const EyeOff = make(ViewOffSlashIcon, "EyeOff");
export const FileSpreadsheet = make(Xls02Icon, "FileSpreadsheet");
export const Filter = make(FilterIcon, "Filter");
export const Flame = make(FireIcon, "Flame");
export const HardHat = make(HardHatIcon, "HardHat");
export const Info = make(InformationCircleIcon, "Info");
export const KeyRound = make(Key01Icon, "KeyRound");
export const LayoutDashboard = make(DashboardSquare01Icon, "LayoutDashboard");
export const Lock = make(SquareLock02Icon, "Lock");
export const LogOut = make(Logout01Icon, "LogOut");
export const Monitor = make(ComputerIcon, "Monitor");
export const Plus = make(PlusSignIcon, "Plus");
export const PlusCircle = make(AddCircleIcon, "PlusCircle");
export const Printer = make(PrinterIcon, "Printer");
export const RefreshCw = make(RefreshIcon, "RefreshCw");
export const RotateCcw = make(Undo02Icon, "RotateCcw");
export const Save = make(FloppyDiskIcon, "Save");
export const Scale = make(BalanceScaleIcon, "Scale");
export const Search = make(Search01Icon, "Search");
export const ShieldAlert = make(SecurityWarningIcon, "ShieldAlert");
export const ShieldCheck = make(SecurityCheckIcon, "ShieldCheck");
export const Smartphone = make(SmartPhone01Icon, "Smartphone");
export const Snowflake = make(SnowIcon, "Snowflake");
export const Tag = make(Tag01Icon, "Tag");
export const Target = make(Target02Icon, "Target");
export const Trash2 = make(Delete02Icon, "Trash2");
export const TrendingUp = make(ChartLineData02Icon, "TrendingUp");
export const Upload = make(Upload01Icon, "Upload");
export const UploadCloud = make(CloudUploadIcon, "UploadCloud");
export const User = make(UserIcon, "User");
export const X = make(Cancel01Icon, "X");
