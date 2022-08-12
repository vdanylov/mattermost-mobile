// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIsFocused, useNavigation} from '@react-navigation/native';
import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {FlatList, StyleSheet, ViewProps} from 'react-native';
import Animated, {useAnimatedStyle, withTiming} from 'react-native-reanimated';
import {Edge, SafeAreaView} from 'react-native-safe-area-context';

import {addSearchToTeamSearchHistory} from '@actions/local/team';
import {searchPosts, searchFiles} from '@actions/remote/search';
import Autocomplete from '@components/autocomplete';
import FreezeScreen from '@components/freeze_screen';
import Loading from '@components/loading';
import NavigationHeader from '@components/navigation_header';
import RoundedHeaderContext from '@components/rounded_header_context';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {useCollapsibleHeader} from '@hooks/header';
import {FileFilter, FileFilters, filterFileExtensions} from '@utils/file';
import {TabTypes, TabType} from '@utils/search';

import Initial from './initial';
import Results from './results';
import Header from './results/header';

const EDGES: Edge[] = ['bottom', 'left', 'right'];
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const emptyFileResults: FileInfo[] = [];
const emptyPostResults: string[] = [];
const emptyChannelIds: string[] = [];

const dummyData = [1];

const AutocompletePaddingTop = -4;
const AutocompleteZindex = 11;
const marginFromRoundedHeaderContext = 7;

type Props = {
    teamId: string;
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

const getSearchParams = (terms: string, filterValue?: FileFilter) => {
    const fileExtensions = filterFileExtensions(filterValue);
    const extensionTerms = fileExtensions ? ' ' + fileExtensions : '';
    return {
        terms: terms + extensionTerms,
        is_or_search: true,
    };
};

const searchScreenIndex = 1;

const SearchScreen = ({teamId}: Props) => {
    const nav = useNavigation();
    const isFocused = useIsFocused();
    const intl = useIntl();
    const theme = useTheme();

    const stateIndex = nav.getState().index;
    const serverUrl = useServerUrl();
    const searchTerm = (nav.getState().routes[stateIndex].params as any)?.searchTerm;

    const [cursorPosition, setCursorPosition] = useState(searchTerm?.length);
    const [searchValue, setSearchValue] = useState<string>(searchTerm);
    const [searchTeamId, setSearchTeamId] = useState<string>(teamId);
    const [selectedTab, setSelectedTab] = useState<TabType>(TabTypes.MESSAGES);
    const [filter, setFilter] = useState<FileFilter>(FileFilters.ALL);
    const [showResults, setShowResults] = useState(false);

    const [loading, setLoading] = useState(false);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [lastSearchedValue, setLastSearchedValue] = useState('');

    const [postIds, setPostIds] = useState<string[]>(emptyPostResults);
    const [fileInfos, setFileInfos] = useState<FileInfo[]>(emptyFileResults);
    const [fileChannelIds, setFileChannelIds] = useState<string[]>([]);

    const onSnap = (offset: number) => {
        scrollRef.current?.scrollToOffset({offset, animated: true});
    };

    const {scrollPaddingTop,
        scrollRef,
        scrollValue,
        onScroll,
        headerHeight,
        hideHeader,
        lockValue,
        hideAndLock,
        showAndUnlock,
    } = useCollapsibleHeader<FlatList>(true, onSnap);

    const handleCancelAndClearSearch = useCallback(() => {
        showAndUnlock();
        setSearchValue('');
        setLastSearchedValue('');
        setFilter(FileFilters.ALL);
        setShowResults(false);
    }, []);

    const handleTextChange = useCallback((newValue: string) => {
        setSearchValue(newValue);
        setCursorPosition(newValue.length);
    }, []);

    const handleLoading = useCallback((show: boolean) => {
        if (showResults) {
            setResultsLoading(show);
        } else {
            setLoading(show);
        }
    }, [showResults]);

    const handleSearch = useCallback(async (newSearchTeamId: string, term: string) => {
        const searchParams = getSearchParams(term);
        if (!searchParams.terms) {
            handleCancelAndClearSearch();
            return;
        }
        handleLoading(true);
        setFilter(FileFilters.ALL);
        setLastSearchedValue(term);
        addSearchToTeamSearchHistory(serverUrl, newSearchTeamId, term);
        const [postResults, {files, channels}] = await Promise.all([
            searchPosts(serverUrl, newSearchTeamId, searchParams),
            searchFiles(serverUrl, newSearchTeamId, searchParams),
        ]);

        setFileInfos(files?.length ? files : emptyFileResults);
        setPostIds(postResults?.order?.length ? postResults.order : emptyPostResults);
        setFileChannelIds(channels?.length ? channels : emptyChannelIds);

        setShowResults(true);
        hideAndLock();
        handleLoading(false);
    }, [handleCancelAndClearSearch, handleLoading, showResults]);

    const onSubmit = useCallback(() => {
        handleSearch(searchTeamId, searchValue);
    }, [handleSearch, searchTeamId, searchValue]);

    const handleRecentSearch = useCallback((text: string) => {
        handleTextChange(text);
        handleSearch(searchTeamId, text);
    }, [handleSearch, handleTextChange, searchTeamId]);

    const handleFilterChange = useCallback(async (filterValue: FileFilter) => {
        setFilter(filterValue);
        const searchParams = getSearchParams(lastSearchedValue, filterValue);
        const {files, channels} = await searchFiles(serverUrl, searchTeamId, searchParams);
        setFileInfos(files?.length ? files : emptyFileResults);
        setFileChannelIds(channels?.length ? channels : emptyChannelIds);
    }, [lastSearchedValue, searchTeamId]);

    const handleResultsTeamChange = useCallback((newTeamId: string) => {
        setSearchTeamId(newTeamId);
        handleSearch(newTeamId, lastSearchedValue);
    }, [lastSearchedValue, handleSearch]);

    const loadingComponent = useMemo(() => (
        <Loading
            containerStyle={[styles.loading, {paddingTop: scrollPaddingTop}]}
            color={theme.buttonBg}
            size='large'
        />
    ), [theme, scrollPaddingTop]);

    const initialComponent = useMemo(() => (
        <Initial
            searchValue={searchValue}
            setRecentValue={handleRecentSearch}
            setSearchValue={handleTextChange}
            setTeamId={setSearchTeamId}
            teamId={searchTeamId}
        />
    ), [searchValue, searchTeamId, handleRecentSearch, handleTextChange]);

    const resultsComponent = useMemo(() => (
        <Results
            loading={resultsLoading}
            selectedTab={selectedTab}
            searchValue={lastSearchedValue}
            postIds={postIds}
            fileInfos={fileInfos}
            fileChannelIds={fileChannelIds}
        />
    ), [selectedTab, lastSearchedValue, postIds, resultsLoading, fileInfos, fileChannelIds]);

    const renderItem = useCallback(() => {
        if (loading) {
            return loadingComponent;
        }
        if (!showResults) {
            return initialComponent;
        }
        return resultsComponent;
    }, [
        loading && loadingComponent,
        !loading && !showResults && initialComponent,
        !loading && showResults && resultsComponent,
    ]);

    const containerStyle = useMemo(() => {
        const padding = lockValue?.value ? lockValue.value : scrollPaddingTop;
        const justify = resultsLoading ? 'center' : 'flex-start';
        return {paddingTop: padding, flexGrow: 1, justifyContent: justify} as ViewProps;
    }, [scrollPaddingTop, lockValue.value, resultsLoading]);

    const animated = useAnimatedStyle(() => {
        if (isFocused) {
            return {
                opacity: withTiming(1, {duration: 150}),
                flex: 1,
                transform: [{translateX: withTiming(0, {duration: 150})}],
            };
        }

        return {
            opacity: withTiming(0, {duration: 150}),
            transform: [{translateX: withTiming(stateIndex < searchScreenIndex ? 25 : -25, {duration: 150})}],
        };
    }, [isFocused, stateIndex]);

    const top = useAnimatedStyle(() => {
        const topMarginLocked = lockValue?.value ? lockValue.value + marginFromRoundedHeaderContext : 0;
        const topMarginScrollable = headerHeight.value;
        const topMargin = lockValue.value ? topMarginLocked : topMarginScrollable;
        return {
            top: topMargin,
            zIndex: lastSearchedValue ? 10 : 0,
        };
    }, [headerHeight.value, lastSearchedValue, lockValue.value]);

    let header = null;
    if (lastSearchedValue && !loading) {
        header = (
            <Header
                teamId={searchTeamId}
                setTeamId={handleResultsTeamChange}
                onTabSelect={setSelectedTab}
                onFilterChanged={handleFilterChange}
                numberMessages={postIds.length}
                selectedTab={selectedTab}
                numberFiles={fileInfos.length}
                selectedFilter={filter}
            />
        );
    }
    const autocomplete = useMemo(() => (
        <Autocomplete
            paddingTop={AutocompletePaddingTop}
            postInputTop={0}
            updateValue={handleTextChange}
            cursorPosition={cursorPosition}
            value={searchValue}
            isSearch={true}
            hasFilesAttached={false}
        />
    ), [cursorPosition, handleTextChange, searchValue]);

    return (
        <FreezeScreen freeze={!isFocused}>
            <NavigationHeader
                isLargeTitle={true}
                showBackButton={false}
                title={intl.formatMessage({id: 'screen.search.title', defaultMessage: 'Search'})}
                hasSearch={true}
                scrollValue={scrollValue}
                lockValue={lockValue}
                hideHeader={hideHeader}
                onChangeText={handleTextChange}
                onSubmitEditing={onSubmit}
                blurOnSubmit={true}
                placeholder={intl.formatMessage({id: 'screen.search.placeholder', defaultMessage: 'Search messages & files'})}
                onClear={handleCancelAndClearSearch}
                onCancel={handleCancelAndClearSearch}
                defaultValue={searchValue}
            />
            <Animated.View style={[top, {zIndex: AutocompleteZindex}]}>
                {autocomplete}
            </Animated.View>
            <SafeAreaView
                style={styles.flex}
                edges={EDGES}
            >
                <Animated.View style={animated}>
                    <Animated.View style={top}>
                        <RoundedHeaderContext/>
                        {header}
                    </Animated.View>
                    <AnimatedFlatList
                        data={dummyData}
                        contentContainerStyle={containerStyle}
                        keyboardShouldPersistTaps='handled'
                        keyboardDismissMode={'interactive'}
                        nestedScrollEnabled={true}
                        indicatorStyle='black'
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        removeClippedSubviews={false}
                        scrollToOverflowEnabled={true}
                        overScrollMode='always'
                        ref={scrollRef}
                        renderItem={renderItem}
                    />
                </Animated.View>
            </SafeAreaView>
        </FreezeScreen>
    );
};

export default SearchScreen;
