import { type Table as ReactTableType } from "@tanstack/react-table";
import { ActionIcon, Box, Flex, Grid, Select, SelectOption, Text } from "rizzui";
import {
  PiCaretLeftBold,
  PiCaretRightBold,
  PiCaretDoubleLeftBold,
  PiCaretDoubleRightBold,
} from "react-icons/pi";
import cn from "@core/utils/class-names";

const options = [
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 15, label: "15" },
  { value: 20, label: "20" },
  { value: 25, label: "25" },
];

export type TablePaginationLabels = {
  rowsPerPage?: string;
  pageOf?: (page: number, total: number) => string;
  selectedRows?: (selected: number, total: number) => string;
  goToFirstPage?: string;
  goToPreviousPage?: string;
  goToNextPage?: string;
  goToLastPage?: string;
};

export default function TablePagination<TData extends Record<string, any>>({
  table,
  showSelectedCount = false,
  className,
  labels,
}: {
  table: ReactTableType<TData>;
  showSelectedCount?: boolean;
  className?: string;
  labels?: TablePaginationLabels;
}) {
  const pageIndex = table.getState().pagination.pageIndex + 1;
  const pageCount = table.getPageCount();
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const totalRows = table.getFilteredRowModel().rows.length;

  return (
    <Flex
      gap="6"
      align="center"
      justify="between"
      className={cn("@container", className)}
    >
      <Flex
        align="center"
        className="w-auto shrink-0"
      >
        <Text className="hidden font-normal text-gray-600 @md:block">
          {labels?.rowsPerPage ?? "Rows per page"}
        </Text>
        <Select
          size="sm"
          variant="flat"
          options={options}
          className="w-12"
          value={table.getState().pagination.pageSize}
          onChange={(v: SelectOption) => {
            table.setPageSize(Number(v.value));
          }}
          suffixClassName="[&>svg]:size-3"
          selectClassName="font-semibold text-xs ring-0 shadow-sm h-7"
          optionClassName="font-medium text-xs px-2 justify-center"
        />
      </Flex>
      {showSelectedCount && (
        <Box className="hidden @2xl:block w-full">
          <Text>
            {labels?.selectedRows
              ? labels.selectedRows(selectedCount, totalRows)
              : `${selectedCount} of ${totalRows} row(s) selected.`}
          </Text>
        </Box>
      )}
      <Flex
        justify="end"
        align="center"
      >
        <Text className="hidden font-normal text-gray-600 @3xl:block">
          {labels?.pageOf
            ? labels.pageOf(pageIndex, pageCount)
            : `Page ${pageIndex} of ${pageCount.toLocaleString()}`}
        </Text>
        <Grid
          gap="2"
          columns="4"
        >
          <ActionIcon
            size="sm"
            rounded="lg"
            variant="outline"
            aria-label={labels?.goToFirstPage ?? "Go to first page"}
            onClick={() => table.firstPage()}
            disabled={!table.getCanPreviousPage()}
            className="text-gray-900 shadow-sm disabled:text-gray-400 disabled:shadow-none"
          >
            <PiCaretDoubleLeftBold className="size-3.5" />
          </ActionIcon>
          <ActionIcon
            size="sm"
            rounded="lg"
            variant="outline"
            aria-label={labels?.goToPreviousPage ?? "Go to previous page"}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="text-gray-900 shadow-sm disabled:text-gray-400 disabled:shadow-none"
          >
            <PiCaretLeftBold className="size-3.5" />
          </ActionIcon>
          <ActionIcon
            size="sm"
            rounded="lg"
            variant="outline"
            aria-label={labels?.goToNextPage ?? "Go to next page"}
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="text-gray-900 shadow-sm disabled:text-gray-400 disabled:shadow-none"
          >
            <PiCaretRightBold className="size-3.5" />
          </ActionIcon>
          <ActionIcon
            size="sm"
            rounded="lg"
            variant="outline"
            aria-label={labels?.goToLastPage ?? "Go to last page"}
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage()}
            className="text-gray-900 shadow-sm disabled:text-gray-400 disabled:shadow-none"
          >
            <PiCaretDoubleRightBold className="size-3.5" />
          </ActionIcon>
        </Grid>
      </Flex>
    </Flex>
  );
}
