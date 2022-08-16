// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, FlatList, ListRenderItemInfo, StyleProp, View, ViewStyle} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import File from '@components/files/file';
import NoResultsWithTerm from '@components/no_results_with_term';
import {ITEM_HEIGHT} from '@components/option_item';
import {useTheme} from '@context/theme';
import {useIsTablet} from '@hooks/device';
import {useImageAttachments} from '@hooks/files';
import {bottomSheet, dismissBottomSheet} from '@screens/navigation';
import NavigationStore from '@store/navigation_store';
import {isImage, isVideo} from '@utils/file';
import {fileToGalleryItem, openGalleryAtIndex} from '@utils/gallery';
import {bottomSheetSnapPoint} from '@utils/helpers';
import {getViewPortWidth} from '@utils/images';
import {TabTypes} from '@utils/search';
import {preventDoubleTap} from '@utils/tap';

import FileOptions from './file_options';
import {HEADER_HEIGHT} from './file_options/header';

import type ChannelModel from '@typings/database/models/servers/channel';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginHorizontal: 20,
    },
});

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

type Props = {
    canDownloadFiles: boolean;
    fileChannels: ChannelModel[];
    fileInfos: FileInfo[];
    publicLinkEnabled: boolean;
    scrollPaddingTop: number;
    searchValue: string;
}

const galleryIdentifier = 'search-files-location';

const FileResults = ({
    canDownloadFiles,
    fileChannels,
    fileInfos,
    publicLinkEnabled,
    scrollPaddingTop,
    searchValue,
}: Props) => {
    const theme = useTheme();
    const isTablet = useIsTablet();
    const insets = useSafeAreaInsets();
    const [lastViewedIndex, setLastViewedIndex] = useState<number | undefined>(undefined);

    const paddingTop = useMemo(() => ({paddingTop: scrollPaddingTop, flexGrow: 1}), [scrollPaddingTop]);
    const {images: imageAttachments, nonImages: nonImageAttachments} = useImageAttachments(fileInfos, publicLinkEnabled);
    const channelNames = useMemo(() => fileChannels.reduce<{[id: string]: string | undefined}>((acc, v) => {
        acc[v.id] = v.displayName;
        return acc;
    }, {}), [fileChannels]);

    const containerStyle = useMemo(() => {
        const padding = fileInfos.length ? 8 : 0;
        return {top: padding};
    }, [fileInfos]);

    const filesForGallery = useMemo(() => imageAttachments.concat(nonImageAttachments),
        [imageAttachments, nonImageAttachments]);

    const orderedFilesForGallery = useMemo(() => (
        filesForGallery.sort((a: FileInfo, b: FileInfo) => {
            return (b.create_at || 0) - (a.create_at || 0);
        })
    ), [filesForGallery]);

    const filesForGalleryIndexes = useMemo(() => orderedFilesForGallery.reduce<{[id: string]: number | undefined}>((acc, v, idx) => {
        if (v.id) {
            acc[v.id] = idx;
        }
        return acc;
    }, {}), [orderedFilesForGallery]);

    const handlePreviewPress = useCallback(preventDoubleTap((idx: number) => {
        const items = orderedFilesForGallery.map((f) => fileToGalleryItem(f, f.user_id));
        openGalleryAtIndex(galleryIdentifier, idx, items);
    }), [orderedFilesForGallery]);

    const snapPoints = useMemo(() => {
        let numberOptions = 1;
        if (canDownloadFiles) {
            numberOptions += 1;
        }
        if (publicLinkEnabled) {
            numberOptions += 1;
        }
        return [bottomSheetSnapPoint(numberOptions, ITEM_HEIGHT, insets.bottom) + HEADER_HEIGHT, 10];
    }, [canDownloadFiles, publicLinkEnabled]);

    const handleOptionsPress = useCallback((item: number) => {
        setLastViewedIndex(item);
        const renderContent = () => {
            return (
                <FileOptions
                    fileInfo={orderedFilesForGallery[item]}
                />
            );
        };
        bottomSheet({
            closeButtonId: 'close-search-file-options',
            renderContent,
            snapPoints,
            theme,
            title: '',
        });
    }, [orderedFilesForGallery, snapPoints, theme]);

    // This effect handles the case where a user has the FileOptions Modal
    // open and the server changes the ability to download files or copy public
    // links. Reopen the Bottom Sheet again so the new options are added or
    // removed.
    useEffect(() => {
        if (lastViewedIndex === undefined) {
            return;
        }
        if (NavigationStore.getNavigationTopComponentId() === 'BottomSheet') {
            dismissBottomSheet().then(() => {
                handleOptionsPress(lastViewedIndex);
            });
        }
    }, [canDownloadFiles, publicLinkEnabled]);

    const renderItem = useCallback(({item}: ListRenderItemInfo<FileInfo>) => {
        const updateFileForGallery = (idx: number, file: FileInfo) => {
            'worklet';
            orderedFilesForGallery[idx] = file;
        };

        const container: StyleProp<ViewStyle> = fileInfos.length > 1 ? styles.container : undefined;
        const isSingleImage = orderedFilesForGallery.length === 1 && (isImage(orderedFilesForGallery[0]) || isVideo(orderedFilesForGallery[0]));
        const isReplyPost = false;

        return (
            <View
                style={container}
                key={item.id}
            >
                <File
                    asCard={true}
                    canDownloadFiles={canDownloadFiles}
                    channelName={channelNames[item.channel_id!]}
                    file={item}
                    galleryIdentifier={galleryIdentifier}
                    inViewPort={true}
                    index={filesForGalleryIndexes[item.id!] || 0}
                    isSingleImage={isSingleImage}
                    key={item.id}
                    nonVisibleImagesCount={0}
                    onOptionsPress={handleOptionsPress}
                    onPress={handlePreviewPress}
                    publicLinkEnabled={publicLinkEnabled}
                    showDate={true}
                    updateFileForGallery={updateFileForGallery}
                    wrapperWidth={(getViewPortWidth(isReplyPost, isTablet) - 6)}
                />
            </View>
        );
    }, [
        (orderedFilesForGallery.length === 1) && orderedFilesForGallery[0].mime_type,
        canDownloadFiles,
        channelNames,
        fileInfos.length > 1,
        filesForGalleryIndexes,
        handleOptionsPress,
        handlePreviewPress,
        isTablet,
        publicLinkEnabled,
        theme,
    ]);

    const noResults = useMemo(() => {
        return (
            <NoResultsWithTerm
                term={searchValue}
                type={TabTypes.FILES}
            />
        );
    }, [searchValue]);

    return (
        <AnimatedFlatList
            ListEmptyComponent={noResults}
            contentContainerStyle={paddingTop}
            data={fileInfos}
            indicatorStyle='black'
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            nestedScrollEnabled={true}
            refreshing={false}
            removeClippedSubviews={true}
            renderItem={renderItem}
            scrollEventThrottle={16}
            scrollToOverflowEnabled={true}
            showsVerticalScrollIndicator={true}
            style={containerStyle}
            testID='search_results.post_list.flat_list'
        />
    );
};

export default FileResults;